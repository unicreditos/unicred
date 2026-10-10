import { ActionButton } from '@/components/admin/action-button'
import { Card, CardHead, NoAccess, PageHead } from '@/components/uc/blocks'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { listDiditWebhooks } from '@/lib/admin-external'

export const metadata = { title: 'Webhooks de Didit' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date | null) => (d ? d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—')

export default async function WebhooksDiditPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = <PageHead title="Webhooks de Didit" description="Eventos de verificación recibidos. Los que no se procesaron se pueden reprocesar sin entrar al panel de Didit." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="los webhooks de Didit" /></>
  await auditAdminView(userId, 'webhooks_didit')
  const items = await listDiditWebhooks({ limit: 150 }).catch(() => [])
  const failed = items.filter((i) => i.failed)
  return (
    <>
      {head}
      <Card>
        <CardHead title={`Fallidos o sin procesar (${failed.length})`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="uc-dt">
            <thead><tr><th>Recibido</th><th>Tipo</th><th>Sesión</th><th>Estado</th><th><span className="uc-sr-only">Acción</span></th></tr></thead>
            <tbody>
              {failed.length === 0 ? <tr><td colSpan={5}>No hay webhooks pendientes. Todo se procesó.</td></tr> : null}
              {failed.map((w) => (
                <tr key={w.id}>
                  <td data-label="Recibido">{fmt(w.createdAt)}</td>
                  <td data-label="Tipo">{w.webhookType}</td>
                  <td data-label="Sesión"><code>{w.sessionId?.slice(0, 12) ?? '—'}</code></td>
                  <td data-label="Estado">{w.status ?? '—'}</td>
                  <td><ActionButton url={`/api/admin/didit-webhooks/${w.id}/resend`} label="Reprocesar" confirm="¿Reprocesar este webhook?" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHead title="Últimos eventos" />
        <div style={{ overflowX: 'auto' }}>
          <table className="uc-dt">
            <thead><tr><th>Recibido</th><th>Tipo</th><th>Sesión</th><th>Estado</th><th>Procesado</th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td data-label="Recibido">{fmt(w.createdAt)}</td>
                  <td data-label="Tipo">{w.webhookType}</td>
                  <td data-label="Sesión"><code>{w.sessionId?.slice(0, 12) ?? '—'}</code></td>
                  <td data-label="Estado">{w.status ?? '—'}</td>
                  <td data-label="Procesado">{w.processed ? `Sí · ${fmt(w.processedAt)}` : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}