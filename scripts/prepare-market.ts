/**
 * Deja la base lista para operar créditos: limpia residuos, repara roles
 * y asegura productos + ficha de comercio. Usa .env.local.
 */
import path from 'node:path'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { LOAN_CATALOG } from '../lib/loan-catalog'
import { computeFrenchAmortization } from '../lib/finance'

dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true })

function cleanUrl(url: string) {
  const u = new URL(url)
  u.searchParams.delete('channel_binding')
  u.searchParams.delete('sslmode')
  return u.toString()
}

const PRODUCTS = LOAN_CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  type: p.type,
  minAmount: p.minAmount.toFixed(2),
  maxAmount: p.maxAmount.toFixed(2),
  minTerm: p.minTerm,
  maxTerm: p.maxTerm,
  monthlyRate: p.monthlyRate.toFixed(3),
  tna: computeFrenchAmortization(p.referenceAmount, p.referenceTerm, p.monthlyRate).tna.toFixed(3),
}))

async function main() {
  const raw = process.env.DATABASE_URL
  if (!raw) {
    console.error('DATABASE_URL no definida en .env.local')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: cleanUrl(raw),
    ssl: raw.includes('neon.tech') ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 30000,
  })

  console.log('1/6 Eliminando tablas core_* residuales…')
  await pool.query(`
    DROP TABLE IF EXISTS
      core_movement,
      core_card,
      core_payment_link,
      core_webhook_event,
      core_webhook,
      core_collection,
      core_echeq,
      core_beneficiary,
      core_alert,
      core_transfer,
      core_wallet,
      core_api_log
    CASCADE
  `)

  console.log('2/6 Borrando perfiles sin usuario…')
  const orphans = await pool.query(`
    DELETE FROM profile p
    WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = p."userId")
  `)
  console.log(`   ${orphans.rowCount ?? 0} perfiles huérfanos`)

  console.log('3/6 Creando perfiles faltantes y sincronizando roles…')
  await pool.query(`
    INSERT INTO profile (id, "userId", role, "kycStatus", "createdAt", "updatedAt")
    SELECT
      'prof_' || substr(u.id, greatest(length(u.id) - 11, 1)),
      u.id,
      coalesce(nullif(u.role, ''), 'customer'),
      'pending',
      now(),
      now()
    FROM "user" u
    WHERE NOT EXISTS (SELECT 1 FROM profile p WHERE p."userId" = u.id)
  `)

  await pool.query(`
    UPDATE profile
    SET role = 'customer', "updatedAt" = now()
    WHERE role IS NULL OR role = ''
  `)

  await pool.query(`
    UPDATE "user" u
    SET role = p.role, "updatedAt" = now()
    FROM profile p
    WHERE p."userId" = u.id
      AND (u.role IS NULL OR u.role = '' OR u.role IS DISTINCT FROM p.role)
  `)

  await pool.query(`ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'customer'`)
  await pool.query(`UPDATE "user" SET role = 'customer' WHERE role IS NULL OR role = ''`)
  await pool.query(`ALTER TABLE "user" ALTER COLUMN role SET NOT NULL`)

  console.log('4/6 Asegurando ficha de comercio para usuarios merchant…')
  await pool.query(`
    INSERT INTO merchant (
      id, "userId", "businessName", cuit, category, status, "commissionRate", "createdAt", "updatedAt"
    )
    SELECT
      'merch_' || substr(u.id, greatest(length(u.id) - 11, 1)),
      u.id,
      coalesce(nullif(u.name, ''), 'Comercio UNICRÉDITOS'),
      coalesce(nullif(p.cuil, ''), '30' || lpad((abs(hashtext(u.id)) % 1000000000)::text, 9, '0')),
      'general',
      'active',
      '8.00',
      now(),
      now()
    FROM "user" u
    JOIN profile p ON p."userId" = u.id
    WHERE p.role = 'merchant'
      AND NOT EXISTS (SELECT 1 FROM merchant m WHERE m."userId" = u.id)
  `)

  console.log('5/6 Productos de crédito…')
  for (const p of PRODUCTS) {
    await pool.query(
      `INSERT INTO loan_product (
         id, name, type, "minAmount", "maxAmount", "minTerm", "maxTerm",
         "monthlyRate", tna, active, "createdAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         type = excluded.type,
         "minAmount" = excluded."minAmount",
         "maxAmount" = excluded."maxAmount",
         "minTerm" = excluded."minTerm",
         "maxTerm" = excluded."maxTerm",
         "monthlyRate" = excluded."monthlyRate",
         tna = excluded.tna,
         active = true`,
      [p.id, p.name, p.type, p.minAmount, p.maxAmount, p.minTerm, p.maxTerm, p.monthlyRate, p.tna],
    )
  }

  console.log('6/6 Verificación…')
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'core_%')::int AS core_left,
      (SELECT count(*) FROM "user")::int AS users,
      (SELECT count(*) FROM "user" WHERE role IS NULL)::int AS users_without_role,
      (SELECT count(*) FROM profile p LEFT JOIN "user" u ON u.id = p."userId" WHERE u.id IS NULL)::int AS orphan_profiles,
      (SELECT count(*) FROM profile p JOIN "user" u ON u.id = p."userId" WHERE p.role = 'merchant')::int AS merchant_profiles,
      (SELECT count(*) FROM merchant)::int AS merchants,
      (SELECT count(*) FROM loan_product WHERE active)::int AS products,
      (SELECT count(*) FROM "user" WHERE role = 'admin')::int AS admins
  `)
  console.log(rows[0])
  await pool.end()
  console.log('\nBase lista para operar créditos.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
