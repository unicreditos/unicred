import { db } from '@/lib/db'
import { arcaSalesPointVersion } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ensureArcaConfigSchema } from '@/lib/db/ensure-arca-config'

/** Punto de venta vigente. Usar en el flujo real de emisión (lib/arca/wsfe.ts). null = todavía no configurado. */
export async function getActivePtoVta(): Promise<number | null> {
  await ensureArcaConfigSchema()
  const [active] = await db.select().from(arcaSalesPointVersion).where(eq(arcaSalesPointVersion.isActive, true)).limit(1)
  return active ? active.ptoVta : null
}

