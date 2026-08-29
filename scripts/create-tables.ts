import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no definida')
    process.exit(1)
  }

  console.log('Aplicando schema completo con drizzle-kit push...')
  const pushed = spawnSync('npx', ['drizzle-kit', 'push', '--force'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if (pushed.status !== 0) {
    process.exit(pushed.status ?? 1)
  }

  const { db, pool } = await import('@/lib/db')
  const { loanProduct } = await import('@/lib/db/schema')
  const products = [
    {
      id: 'prod_personal',
      name: 'Préstamo Personal UNICRÉDITOS',
      type: 'personal',
      minAmount: '50000.00',
      maxAmount: '3000000.00',
      minTerm: 3,
      maxTerm: 48,
      monthlyRate: '7.500',
      tna: '90.000',
      active: true,
    },
    {
      id: 'prod_consumo',
      name: 'Crédito de Consumo en Cuotas',
      type: 'consumo',
      minAmount: '10000.00',
      maxAmount: '1000000.00',
      minTerm: 1,
      maxTerm: 24,
      monthlyRate: '8.200',
      tna: '98.400',
      active: true,
    },
    {
      id: 'prod_comercio',
      name: 'Financiación Comercio',
      type: 'comercio',
      minAmount: '20000.00',
      maxAmount: '5000000.00',
      minTerm: 1,
      maxTerm: 24,
      monthlyRate: '6.900',
      tna: '82.800',
      active: true,
    },
  ]

  let inserted = 0
  for (const product of products) {
    try {
      await db.insert(loanProduct).values(product as typeof loanProduct.$inferInsert).onConflictDoNothing({
        target: loanProduct.id,
      })
      inserted++
    } catch (err) {
      console.warn('Seed producto:', (err as Error).message)
    }
  }
  console.log(`Productos confirmados: ${inserted}`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_account (
      id text PRIMARY KEY,
      "userId" text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active',
      cvu text NOT NULL UNIQUE,
      alias text NOT NULL UNIQUE,
      "holderName" text,
      "taxId" text,
      balance numeric(14, 2) NOT NULL DEFAULT '0',
      currency text NOT NULL DEFAULT 'ARS',
      provider text NOT NULL DEFAULT 'payway',
      "paywayAccountId" text,
      "liveAttempt" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wallet_account_cvu_idx ON wallet_account (cvu);
    CREATE INDEX IF NOT EXISTS wallet_account_alias_idx ON wallet_account (alias);
    CREATE TABLE IF NOT EXISTS wallet_movement (
      id text PRIMARY KEY,
      "walletId" text NOT NULL REFERENCES wallet_account(id) ON DELETE CASCADE,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      direction text NOT NULL,
      kind text NOT NULL,
      amount numeric(14, 2) NOT NULL,
      "balanceAfter" numeric(14, 2) NOT NULL,
      "paymentId" text REFERENCES payment(id) ON DELETE SET NULL,
      "externalId" text,
      reference text,
      notes text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wallet_movement_wallet_idx ON wallet_movement ("walletId");
    CREATE INDEX IF NOT EXISTS wallet_movement_user_idx ON wallet_movement ("userId");
    CREATE UNIQUE INDEX IF NOT EXISTS wallet_movement_external_unique
      ON wallet_movement ("externalId")
      WHERE "externalId" IS NOT NULL;
    ALTER TABLE wallet_account ADD COLUMN IF NOT EXISTS "pomeloAccountId" text;
    ALTER TABLE wallet_movement ADD COLUMN IF NOT EXISTS "payoutId" text;
    ALTER TABLE wallet_movement ADD COLUMN IF NOT EXISTS "counterpartyUserId" text;
    CREATE TABLE IF NOT EXISTS wallet_payout (
      id text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "walletId" text NOT NULL REFERENCES wallet_account(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'queued',
      amount numeric(14, 2) NOT NULL,
      currency text NOT NULL DEFAULT 'ARS',
      "destinationKind" text NOT NULL,
      "destinationValue" text NOT NULL,
      concept text,
      reference text NOT NULL UNIQUE,
      "treasuryCbu" text NOT NULL,
      rail text NOT NULL DEFAULT 'treasury_rm',
      "providerPayload" jsonb,
      "executedAt" timestamptz,
      "executedBy" text,
      "failureReason" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wallet_payout_user_idx ON wallet_payout ("userId");
    CREATE INDEX IF NOT EXISTS wallet_payout_status_idx ON wallet_payout (status);
    CREATE TABLE IF NOT EXISTS service_payment (
      id text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "walletId" text NOT NULL REFERENCES wallet_account(id) ON DELETE CASCADE,
      "providerId" text NOT NULL,
      "providerName" text NOT NULL,
      category text NOT NULL,
      kind text NOT NULL,
      "accountRef" text NOT NULL,
      amount numeric(14, 2) NOT NULL,
      currency text NOT NULL DEFAULT 'ARS',
      status text NOT NULL DEFAULT 'queued',
      reference text NOT NULL UNIQUE,
      "movementId" text,
      "providerPayload" jsonb,
      "executedAt" timestamptz,
      "failureReason" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS service_payment_user_idx ON service_payment ("userId");
    CREATE INDEX IF NOT EXISTS service_payment_status_idx ON service_payment (status);
  `)
  console.log('Billetera virtual + pagos: tablas listas')

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
