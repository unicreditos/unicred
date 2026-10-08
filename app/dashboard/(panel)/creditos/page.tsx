import Link from 'next/link'
import { Badge, ButtonLink, Grid, PageHead, ProgressBar, Card } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import { loadCustomer, loadCustomerContracts } from '@/lib/customer/load'
import { creditState, solRef } from '@/lib/customer/view'
import { fdate, money } from '@/lib/uc/format'

export const metadata = { title: 'Mis créditos' }

const n = (v: unknown) => Number(v) || 0

export default async function CreditosPage() {
  const { userId, loans, installments } = await loadCustomer()
  const contracts = await loadCustomerContracts(userId)
  const accepted = new Set(contracts.filter((c) => c.status === 'accepted').map((c) => c.loanId))

  return (
    <>
      <PageHead
        title="Mis créditos"
        description="Tus créditos vigentes, pendientes y cancelados."
        actions={
          <ButtonLink primary href="/dashboard/solicitar">
            <Icon name="plus" size="sm" />
            Pedir otro crédito
          </ButtonLink>
        }
      />
      {loans.length === 0 ? (
        <Card className="uc-soon">
          <div className="uc-ic"><Icon name="credit" /></div>
          <h2>Todavía no pediste ningún crédito</h2>
          <p>Cuando lo hagas, vas a poder seguirlo paso a paso desde acá.</p>
          <ButtonLink primary href="/dashboard/solicitar">Pedir un crédito</ButtonLink>
        </Card>
      ) : (
        <Grid cols="2">
          {loans.map((l) => {
            const mine = installments.filter((i) => i.loanId === l.id)
            const paid = mine.filter((i) => i.status === 'paid').length
            const st = creditState(l.status, accepted.has(l.id))
            const next = mine
              .filter((i) => i.status === 'pending' || i.status === 'overdue')
              .sort((a, b) => new Date(a.dueDate as Date).getTime() - new Date(b.dueDate as Date).getTime())[0]
            return (
              <Link key={l.id} className="uc-card uc-credit-card" href={`/dashboard/creditos/${l.id}`}>
                <div className="uc-row">
                  <span>
                    <b>Préstamo personal</b>
                    <span className="uc-sub uc-muted uc-small uc-num" style={{ display: 'block' }}>{solRef(l.id)}</span>
                  </span>
                  <Badge tone={st.tone}>{st.key}</Badge>
                </div>
                <div className="uc-row">
                  <span className="uc-big uc-num" style={{ fontSize: 24 }}>{money(n(l.principal))}</span>
                  <span className="uc-muted uc-small uc-num">{l.term} cuotas de {money(n(l.installmentAmount))}</span>
                </div>
                <ProgressBar value={l.term ? (paid / l.term) * 100 : 0} label="Cuotas pagadas" />
                <div className="uc-row uc-small uc-muted">
                  <span className="uc-num">{paid}/{l.term} cuotas pagadas</span>
                  <span className="uc-num">
                    {next
                      ? `Próx. vto. ${fdate(next.dueDate as Date)}`
                      : st.key === 'Cancelado'
                        ? 'Cancelado'
                        : st.key === 'Firma pendiente'
                          ? 'Firmá el contrato para recibir el dinero'
                          : st.key === 'Rechazado'
                            ? 'Solicitud rechazada'
                            : 'En proceso'}
                  </span>
                </div>
              </Link>
            )
          })}
        </Grid>
      )}
    </>
  )
}
