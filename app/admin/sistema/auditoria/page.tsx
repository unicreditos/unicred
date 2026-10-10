import { desc } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { Callout, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { ensureAuditSchema } from '@/lib/db/ensure-audit'
import { db } from '@/lib/db'
import { adminAuditLog } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Auditoría' }

const SEVERITY = { info: 'Informativo', warning: 'Atención', error: 'Error' } as const
const TONE = { info: 'neutral', warning: 'warning', error: 'danger' } as const

export default async function AuditoriaPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = (
    <PageHead
      title="Auditoría"
      description="Todo lo que pasa en el sistema: acciones de operadores, de clientes, ingresos, accesos denegados y consultas a datos sensibles."
    />
  )
  if (!perms.has('audit.read')) return <>{head}<NoAccess what="el registro de auditoría" /></>
  await auditAdminView(userId, 'registro_auditoria')

  // Pantalla independiente: lee el registro completo, no depende del resto del backoffice.
  await ensureAuditSchema().catch(() => {})
  const found = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(1000).catch(() => [])

  const rows: GridRow[] = found.map((e) => {
    const sev = (e.severity in SEVERITY ? e.severity : 'info') as keyof typeof SEVERITY
    const ch = (e.changes ?? {}) as { ip?: string | null }
    return {
      id: e.id,
      fecha: new Date(e.createdAt).toISOString(),
      actor: e.actorEmail || (e.actorUserId ? `…${e.actorUserId.slice(-6)}` : 'Sistema'),
      accion: e.action,
      sevKey: SEVERITY[sev],
      sev: badge(SEVERITY[sev], TONE[sev]),
      entidad: e.entityType,
      ref: e.entityId ? `…${e.entityId.slice(-8)}` : '—',
      detalle: e.summary,
      ip: ch.ip ?? '',
    }
  })

  return (
    <>
      {head}
      <div style={{ marginBottom: 20 }}>
        <Callout icon="lock" title="Registro de solo agregado">
          Las líneas no se pueden editar ni borrar desde el sistema: la base rechaza cualquier UPDATE, DELETE o TRUNCATE sobre este registro.
        </Callout>
      </div>
      <DataGrid
        cfg={{
          id: 'audit',
          rows,
          pageSize: 15,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['accion', 'ref', 'actor', 'detalle', 'ip'],
          searchPlaceholder: 'Acción, persona, referencia o IP',
          chips: {
            label: 'Severidad',
            key: 'sevKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Atención', l: 'Atención' },
              { v: 'Error', l: 'Errores' },
            ],
          },
          selects: [
            { key: 'entidad', label: 'Entidad', all: 'Entidad: todas' },
            { key: 'accion', label: 'Acción', all: 'Acción: todas' },
          ],
          columns: [
            { key: 'fecha', label: 'Fecha y hora', kind: 'datetime' },
            { key: 'actor', label: 'Quién' },
            { key: 'accion', label: 'Acción' },
            { key: 'sev', label: 'Severidad', kind: 'badge', order: ['Informativo', 'Atención', 'Error'] },
            { key: 'entidad', label: 'Entidad' },
            { key: 'ref', label: 'Referencia', kind: 'num' },
            { key: 'detalle', label: 'Detalle', muted: true },
            { key: 'ip', label: 'IP', kind: 'num', muted: true },
          ],
          summary: { noun: 'eventos' },
        }}
      />
    </>
  )
}
