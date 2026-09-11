import { db } from '@/lib/db'
import { arcaSalesPointVersion, user as userTable } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { ensureArcaConfigSchema } from '@/lib/db/ensure-arca-config'
import { requirePermission, hasPermission } from '@/lib/rbac'
import { assertAdmin } from '@/lib/session'
import { recordAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

/** Punto de venta vigente. Usar en el flujo real de emisión (lib/arca/wsfe.ts). null = todavía no configurado. */
export async function getActivePtoVta(): Promise<number | null> {
  await ensureArcaConfigSchema()
  const [active] = await db.select().from(arcaSalesPointVersion).where(eq(arcaSalesPointVersion.isActive, true)).limit(1)
  return active ? active.ptoVta : null
}

export type ArcaSalesPointVersionRow = {
  id: string
  version: number
  isActive: boolean
  ptoVta: number
  notes: string | null
  createdByEmail: string | null
  createdAt: Date
}

/** Pantalla de admin: historial completo + si el usuario actual puede configurar. */
export async function getArcaSalesPointDeskData(): Promise<{
  versions: ArcaSalesPointVersionRow[]
  canWrite: boolean
}> {
  const userId = await assertAdmin()
  await ensureArcaConfigSchema()
  const [rows, canWrite] = await Promise.all([
    db
      .select({
        id: arcaSalesPointVersion.id,
        version: arcaSalesPointVersion.version,
        isActive: arcaSalesPointVersion.isActive,
        ptoVta: arcaSalesPointVersion.ptoVta,
        notes: arcaSalesPointVersion.notes,
        createdAt: arcaSalesPointVersion.createdAt,
        createdByEmail: userTable.email,
      })
      .from(arcaSalesPointVersion)
      .leftJoin(userTable, eq(userTable.id, arcaSalesPointVersion.createdBy))
      .orderBy(desc(arcaSalesPointVersion.version))
      .limit(50),
    hasPermission(userId, 'config.write'),
  ])
  return { versions: rows, canWrite }
}

/**
 * Publica un nuevo punto de venta y lo activa. Nunca edita una versión
 * existente: cada cambio queda como fila nueva, con quién y por qué —
 * mismo patrón que las reglas de riesgo (lib/risk-rules.ts).
 */
export async function createArcaSalesPointVersion(input: { ptoVta: number; notes: string }) {
  const adminUserId = await requirePermission('config.write')

  if (!Number.isInteger(input.ptoVta) || input.ptoVta <= 0 || input.ptoVta > 9999) {
    throw new Error('Punto de venta inválido (tiene que ser un número entero mayor a 0, tal como figura en AFIP).')
  }
  if (!input.notes?.trim()) {
    throw new Error('Contá el motivo del cambio: queda en el historial.')
  }

  await ensureArcaConfigSchema()

  const [current] = await db
    .select()
    .from(arcaSalesPointVersion)
    .where(eq(arcaSalesPointVersion.isActive, true))
    .limit(1)
  const nextVersion = (current?.version ?? 0) + 1
  const id = `arca_pv_v${nextVersion}`

  await db.transaction(async (tx) => {
    if (current) {
      await tx.update(arcaSalesPointVersion).set({ isActive: false }).where(eq(arcaSalesPointVersion.id, current.id))
    }
    await tx.insert(arcaSalesPointVersion).values({
      id,
      version: nextVersion,
      isActive: true,
      ptoVta: input.ptoVta,
      notes: input.notes.trim(),
      createdBy: adminUserId,
    })
  })

  await recordAudit({
    actorUserId: adminUserId,
    action: 'ARCA_SALES_POINT_VERSIONED',
    entityType: 'arca_sales_point_version',
    entityId: id,
    severity: 'warning',
    summary: `Punto de venta ARCA v${nextVersion} activado (${input.ptoVta}): ${input.notes.trim()}`,
    changes: current ? { ptoVta: { from: current.ptoVta, to: input.ptoVta } } : undefined,
  })

  revalidatePath('/admin')
  return { ok: true as const, version: nextVersion, ptoVta: input.ptoVta }
}
