import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { arcaSalesPointVersion } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

let ensured = false

/**
 * Alta one-shot: no hay carpeta de migraciones Drizzle en este repo.
 * Si ya había un AFIP_PTO_VTA en el entorno, lo usa como semilla v1 (migración
 * suave); si no, deja la tabla vacía a propósito — sin fila activa, emitir una
 * factura tiene que fallar con un mensaje claro en vez de facturar contra el
 * punto de venta 1 sin que nadie lo haya confirmado.
 */
export async function ensureArcaConfigSchema() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS arca_sales_point_version (
      id text PRIMARY KEY,
      version integer NOT NULL,
      "isActive" boolean NOT NULL DEFAULT false,
      "ptoVta" integer NOT NULL,
      notes text,
      "createdBy" text REFERENCES "user"(id) ON DELETE SET NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS arca_sales_point_version_active_idx ON arca_sales_point_version ("isActive")`)

  const [active] = await db.select().from(arcaSalesPointVersion).where(eq(arcaSalesPointVersion.isActive, true)).limit(1)
  if (!active) {
    const fromEnv = Number(process.env.AFIP_PTO_VTA || '')
    if (Number.isInteger(fromEnv) && fromEnv > 0) {
      await db.insert(arcaSalesPointVersion).values({
        id: 'arca_pv_v1',
        version: 1,
        isActive: true,
        ptoVta: fromEnv,
        notes: 'Semilla automática desde AFIP_PTO_VTA (variable de entorno previa).',
      })
    }
  }

  ensured = true
}
