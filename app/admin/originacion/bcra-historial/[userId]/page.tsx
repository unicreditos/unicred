import { ActionButton } from '@/components/admin/action-button'
import { BackLink, Card, CardHead, NoAccess, PageHead } from '@/components/uc/blocks'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { bcraHistory } from '@/lib/admin-external'

export const metadata = { title: 'Historial BCRA del cliente' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date | null) => (d ? d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—')

export default async function BcraClientePage({ params }: { params: Promise<{ userId: string }> }) {
  const { perms, userId: actor } = await loadDeskChrome()
  const { userId } = await params
  const head = <PageHead title="Historial BCRA del cliente" description="Todas las consultas a la Central de Deudores, de la más nueva a la más vieja." />
  if (!perms.has('risk.read')) return <>{head}<NoAccess what="el historial BCRA" /></>
  await auditAdminView(actor, 'historial_bcra_cliente', userId)
  const items = await bcraHistory(userId).catch(() => [])
  return (
    <>
      <BackLink href="/admin/originacion/bcra-historial">Volver al historial</BackLink>
      {head}
      <Card>
        <CardHead title={`Consultas (${items.length})`} aside={<ActionButton url={`/api/admin/bcra/${userId}`} label="Actualizar consulta" confirm="Se consulta al BCRA con el CUIL del cliente. ¿Continuar?" />} />
        <div style={{ overflowX: 'auto' }}>
          <table className="uc-dt">
            <thead><tr><th>Fecha</th><th>CUIL</th><th>Peor situación</th><th>Deuda total</th><th>Entidades</th><th>Cheques rechazados</th><th>Score</th><th>Fuente</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={8}>Sin consultas.</td></tr> : null}
              {items.map((c) => (
                <tr key={c.id}>
                  <td data-label="Fecha">{fmt(c.consultedAt ?? c.createdAt)}</td>
                  <td data-label="CUIL">{c.cuil}</td>
                  <td data-label="Peor situación">{c.worstSituation ?? '—'}</td>
                  <td data-label="Deuda total">{c.totalDebt == null ? '—' : Number(c.totalDebt).toLocaleString('es-AR')}</td>
                  <td data-label="Entidades">{c.entitiesCount ?? '—'}</td>
                  <td data-label="Cheques rechazados">{c.hasRejectedChecks ? 'Sí' : 'No'}</td>
                  <td data-label="Score">{c.computedScore ?? '—'}</td>
                  <td data-label="Fuente">{c.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}