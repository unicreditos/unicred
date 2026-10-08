import { DataGrid } from '@/components/uc/data-grid'
import { Callout, Card, NoAccess, PageHead } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, bcraBadge, bcraByClient, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'En revisión' }

export default async function RevisionPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="En revisión" description="Solicitudes en curso. Cada etapa se habilita solo cuando la anterior está completa." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="las solicitudes en revisión" /></>

  const idx = clientIndex(state)
  const bcra = bcraByClient(state)
  const pending = state.applications.filter((a) => a.status === 'pending')
  const stageOf = (clientId: string) => (idx.get(clientId)?.kycStatus === 'verified' ? 1 : 0)
  const count = [0, 1].map((s) => pending.filter((a) => stageOf(a.clientId) === s).length)
  const queued = state.disbursements.filter((d) => d.status === 'queued' || d.status === 'processing').length

  const rows: GridRow[] = pending.map((a) => {
    const stage = stageOf(a.clientId)
    return {
      id: a.id,
      sol: `…${a.id.slice(-8)}`,
      cliente: clientCell(idx, a.clientId),
      q: clientSearch(idx, a.clientId),
      importe: a.amount,
      cuotas: a.installments,
      etapaKey: String(stage),
      etapa: stage === 0 ? badge('Validación de identidad', 'info') : badge('Revisión manual de finanzas', 'warning'),
      bcra: bcraBadge(bcra.get(a.clientId)?.sit),
      ingreso: a.createdAt,
      ver: [{ kind: 'link', label: 'Revisar', href: `/admin/originacion/solicitudes/${encodeURIComponent(a.id)}` }],
    }
  })

  return (
    <>
      {head}
      <Card className="uc-flow" style={{ gridTemplateColumns: 'repeat(3,1fr)' }} aria-label="Flujo de estados del crédito">
        <div className="uc-step">
          <div className="uc-step-n">1</div>
          <h3>Validación de identidad</h3>
          <div className="uc-cnt"><b className="uc-num">{count[0]}</b>solicitudes</div>
        </div>
        <div className="uc-step uc-manual">
          <div className="uc-step-n">2</div>
          <h3>Revisión manual de finanzas</h3>
          <div className="uc-cnt"><b className="uc-num">{count[1]}</b>solicitudes</div>
          <div className="uc-note">
            <Icon name="lock" size="xs" />
            <span>Acá quedan las solicitudes que el scoring no resolvió solo (revisión manual): decide una persona de Finanzas.</span>
          </div>
        </div>
        <div className="uc-step uc-money">
          <div className="uc-step-n">3</div>
          <h3>Desembolso</h3>
          <div className="uc-cnt"><b className="uc-num">{queued}</b>pendientes</div>
          <div className="uc-note">
            <Icon name="clip" size="xs" />
            <span>Se acredita cuando se transfiere el dinero al cliente.</span>
          </div>
        </div>
      </Card>
      <DataGrid
        cfg={{
          id: 'revision',
          rows,
          pageSize: 15,
          sort: { key: 'ingreso', dir: 1 },
          dateKey: 'ingreso',
          dateLabel: 'Ingreso',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI o N° de solicitud',
          chips: {
            label: 'Etapa',
            key: 'etapaKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: '0', l: 'Identidad' },
              { v: '1', l: 'Finanzas' },
            ],
          },
          columns: [
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'etapa', label: 'Etapa', kind: 'badge', order: ['Validación de identidad', 'Revisión manual de finanzas'] },
            { key: 'bcra', label: 'BCRA', kind: 'badge', order: ['Sin consultar', 'Situación 1', 'Situación 2', 'Situación 3', 'Situación 4', 'Situación 5'] },
            { key: 'ingreso', label: 'Ingreso', kind: 'date' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'solicitudes', sumKey: 'importe', sumLabel: 'solicitados' },
        }}
      />
      <div className="uc-section-gap" />
      <Callout icon="clock" title="El plazo corre desde el ingreso">
        Ordenamos por antigüedad para que lo más viejo se revise primero.
      </Callout>
    </>
  )
}
