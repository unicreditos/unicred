import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getLoanProducts } from '@/app/actions/loans'
import { getMyBankAccounts } from '@/app/actions/banking'
import { Badge, ButtonLink, CardHead, Grid, Pad, PageHead, ProgressBar } from '@/components/uc/blocks'
import { Icon, type IconName } from '@/components/uc/icons'
import { db } from '@/lib/db'
import { bcraCheck, disbursement, payment } from '@/lib/db/schema'
import { estimateLine } from '@/lib/customer/offer'
import { loadCustomer, loadCustomerContracts } from '@/lib/customer/load'
import { solRef } from '@/lib/customer/view'
import { daysBetween, fdate, money } from '@/lib/uc/format'

export const metadata = { title: 'Inicio' }

const n = (v: unknown) => Number(v) || 0

type Activity = { icon: IconName; t: string; s: string; at: Date; amount?: number }

export default async function CustomerHome() {
  const { userId, user, profile, loans, installments, identityVerified } = await loadCustomer()
  const [accounts, contracts, products, lastCheck, payments, disbursements] = await Promise.all([
    getMyBankAccounts().catch(() => []),
    loadCustomerContracts(userId),
    getLoanProducts().catch(() => []),
    db.select().from(bcraCheck).where(eq(bcraCheck.userId, userId)).orderBy(desc(bcraCheck.createdAt)).limit(1).then((r) => r[0] ?? null).catch(() => null),
    db.select().from(payment).where(eq(payment.userId, userId)).orderBy(desc(payment.createdAt)).limit(8).catch(() => []),
    db.select().from(disbursement).where(eq(disbursement.userId, userId)).orderBy(desc(disbursement.createdAt)).limit(5).catch(() => []),
  ])

  const now = new Date()
  const firstName = user.name.split(' ')[0]
  const active = loans.filter((l) => l.status === 'active')
  const open = installments
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .sort((a, b) => new Date(a.dueDate as Date).getTime() - new Date(b.dueDate as Date).getTime())
  const activeIds = new Set(active.map((l) => l.id))
  const openActive = open.filter((i) => activeIds.has(i.loanId))
  const next = openActive[0]
  const days = next ? daysBetween(now, next.dueDate as Date) : 0
  const debt = openActive.reduce((s, i) => s + n(i.amount), 0)
  const totalInst = installments.filter((i) => activeIds.has(i.loanId)).length
  const paidInst = installments.filter((i) => activeIds.has(i.loanId) && i.status === 'paid').length

  const toSign = loans.find((l) => l.status === 'approved' && contracts.find((c) => c.loanId === l.id)?.status !== 'accepted')
  const lineReady = estimateLine(profile, products, loans, installments, lastCheck?.computedScore)

  const primary = accounts.find((a) => a.isPrimary) ?? accounts[0]
  const steps = [
    { done: identityVerified, t: 'Validar identidad', s: identityVerified ? 'Verificada' : 'Selfie, DNI y prueba de vida', href: '/dashboard/perfil', cta: 'Validar' },
    {
      done: Boolean(primary?.isVerified),
      t: 'Confirmar CBU para el desembolso',
      s: primary ? `${primary.bankName} ···· ${String(primary.cbu || primary.cvu || '').slice(-4)}` : 'Cargá una cuenta a tu nombre',
      href: '/dashboard/perfil',
      cta: primary ? 'Validar' : 'Cargar',
    },
    {
      done: !toSign,
      t: 'Firmar contrato',
      s: toSign ? `${solRef(toSign.id)} · ${money(n(toSign.principal))}` : 'Nada para firmar',
      href: '/dashboard/documentos',
      cta: 'Firmar',
    },
  ]

  const feed: Activity[] = [
    ...payments
      .filter((p) => p.status === 'paid' || p.status === 'approved')
      .map((p) => ({ icon: 'check' as const, t: 'Pago acreditado', s: p.method === 'mercadopago' ? 'Mercado Pago' : 'Transferencia', at: new Date((p.paidAt ?? p.createdAt) as Date), amount: n(p.amount) })),
    ...disbursements
      .filter((d) => d.status === 'credited')
      .map((d) => ({ icon: 'wallet' as const, t: 'Recibiste el desembolso', s: solRef(d.loanId), at: new Date((d.creditedAt ?? d.createdAt) as Date), amount: n(d.amount) })),
    ...(toSign ? [{ icon: 'gift' as const, t: 'Tenés un crédito aprobado para firmar', s: `${solRef(toSign.id)} · ${money(n(toSign.principal))} en ${toSign.term} cuotas`, at: new Date(toSign.updatedAt as Date) }] : []),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4)

  return (
    <>
      <PageHead title={`Hola, ${firstName}`} description={`Este es el resumen de tu cuenta al ${fdate(now)}.`} />

      <Grid cols="21">
        <Pad aria-labelledby="prox-t">
          <div className="uc-card-h">
            <h2 id="prox-t">Próxima cuota</h2>
            {next ? <Badge tone={next.status === 'overdue' || days <= 3 ? 'warning' : 'info'}>{next.status === 'overdue' ? 'Vencida' : days <= 3 ? `Vence en ${Math.max(days, 0)} días` : `Faltan ${days} días`}</Badge> : null}
          </div>
          {next ? (
            <>
              <div className="uc-big uc-num">{money(n(next.amount))}</div>
              <p className="uc-muted" style={{ margin: '6px 0 18px' }}>
                Cuota <b className="uc-num">{next.number}/{next.loanTerm}</b> · vence el <b className="uc-num">{fdate(next.dueDate as Date)}</b> · <span className="uc-num" style={{ whiteSpace: 'nowrap' }}>{solRef(next.loanId)}</span>
              </p>
              <div className="uc-cta-row">
                <ButtonLink primary large href={`/dashboard/pagos?pay=${next.id}`}>
                  <Icon name="wallet" size="sm" />
                  Pagar cuota
                </ButtonLink>
                <ButtonLink large href={`/dashboard/creditos/${next.loanId}`}>Ver cronograma</ButtonLink>
              </div>
            </>
          ) : (
            <>
              <div className="uc-big uc-num">Sin cuotas</div>
              <p className="uc-muted" style={{ margin: '6px 0 18px' }}>
                {loans.length ? 'No tenés cuotas pendientes por ahora.' : 'Cuando se acredite tu primer crédito, tu plan de cuotas aparece acá.'}
              </p>
              {!active.length ? (
                <div className="uc-cta-row">
                  <ButtonLink primary large href="/dashboard/solicitar">
                    <Icon name="plus" size="sm" />
                    Pedir un crédito
                  </ButtonLink>
                </div>
              ) : null}
            </>
          )}
        </Pad>
        <Pad>
          <div className="uc-card-h">
            <h2>Saldo adeudado</h2>
            <span>{active.length} crédito{active.length === 1 ? '' : 's'} vigente{active.length === 1 ? '' : 's'}</span>
          </div>
          <div className="uc-big uc-num" style={{ fontSize: 26 }}>{money(debt)}</div>
          <div style={{ margin: '14px 0 8px' }}>
            <ProgressBar value={totalInst ? (paidInst / totalInst) * 100 : 0} label="Cuotas pagadas" />
          </div>
          <p className="uc-muted uc-small" style={{ margin: 0 }}>
            <b className="uc-num" style={{ color: 'var(--uc-text)' }}>{paidInst}</b> de <span className="uc-num">{totalInst}</span> cuotas pagadas
          </p>
        </Pad>
      </Grid>

      <Grid cols="3" className="uc-mt">
        <Pad className="uc-offer">
          <CardHead title="Oferta precalificada" aside={<Icon name="gift" size="sm" />} />
          {lineReady && lineReady.amount > 0 ? (
            <>
              <p className="uc-muted" style={{ margin: 0 }}>Según tu historial tenés disponible</p>
              <div className="uc-big uc-num" style={{ fontSize: 26, margin: '6px 0' }}>hasta {money(lineReady.amount)}</div>
              <p className="uc-muted uc-small" style={{ margin: '0 0 14px' }}>En hasta {lineReady.term} cuotas. Estimación sujeta a revisión de Finanzas.</p>
              <ButtonLink primary href="/dashboard/solicitar">Simular mi crédito</ButtonLink>
            </>
          ) : (
            <>
              <p className="uc-muted" style={{ margin: '0 0 14px' }}>Completá tu perfil y validá tu identidad para ver cuánto podés pedir.</p>
              <ButtonLink primary href="/dashboard/perfil">Completar perfil</ButtonLink>
            </>
          )}
        </Pad>
        <Pad>
          <CardHead title="Pendientes" aside={<span>{steps.filter((s) => s.done).length} de {steps.length} listo</span>} />
          <ul className="uc-check">
            {steps.map((s, i) => (
              <li key={s.t} className={s.done ? 'uc-done' : ''}>
                <span className="uc-ci">{s.done ? <Icon name="check" size="xs" /> : i + 1}</span>
                <span className="uc-tx">
                  <b>{s.t}</b>
                  <small>{s.s}</small>
                </span>
                {!s.done ? <Link className="uc-small" href={s.href}>{s.cta}</Link> : null}
              </li>
            ))}
          </ul>
        </Pad>
        <Pad>
          <CardHead title="Actividad reciente" aside={<Link href="/dashboard/pagos">Ver pagos</Link>} />
          {feed.length ? (
            <ul className="uc-feed">
              {feed.map((a, i) => (
                <li key={i}>
                  <span className="uc-fi"><Icon name={a.icon} size="sm" /></span>
                  <span className="uc-ft">{a.t}<small>{a.s} · {fdate(a.at)}</small></span>
                  {a.amount ? <span className="uc-fa uc-num">{money(a.amount)}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="uc-note">Todavía no tenés movimientos.</p>
          )}
        </Pad>
      </Grid>
    </>
  )
}
