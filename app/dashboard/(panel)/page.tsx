import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getLoanProducts } from '@/app/actions/loans'
import { getMyBankAccounts } from '@/app/actions/banking'
import { Badge, ButtonLink, CardHead, Grid, Pad, PageHead, ProgressBar, SectionTitle } from '@/components/uc/blocks'
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
  const firstName = user.name ? user.name.split(' ')[0] : 'Cliente'
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
    {
      done: identityVerified,
      t: 'Validación de identidad',
      s: identityVerified ? 'Verificada con Didit' : 'Selfie, DNI y prueba de vida',
      href: '/dashboard/perfil/identidad',
      cta: 'Validar ahora',
    },
    {
      done: Boolean(primary?.isVerified),
      t: 'Cuenta bancaria de cobro',
      s: primary ? `${primary.bankName} ···· ${String(primary.cbu || primary.cvu || '').slice(-4)}` : 'Cargá tu CBU o CVU',
      href: '/dashboard/perfil/cuentas',
      cta: primary ? 'Verificada' : 'Cargar CBU',
    },
    {
      done: !toSign,
      t: 'Firma electrónica de contrato',
      s: toSign ? `${solRef(toSign.id)} · ${money(n(toSign.principal))}` : 'Al día',
      href: '/dashboard/documentos',
      cta: 'Firmar',
    },
  ]

  const feed: Activity[] = [
    ...payments
      .filter((p) => p.status === 'paid' || p.status === 'approved')
      .map((p) => ({ icon: 'check' as const, t: 'Pago acreditado', s: p.method === 'mercadopago' ? 'Mercado Pago' : 'Transferencia bancaria', at: new Date((p.paidAt ?? p.createdAt) as Date), amount: n(p.amount) })),
    ...disbursements
      .filter((d) => d.status === 'credited')
      .map((d) => ({ icon: 'wallet' as const, t: 'Desembolso acreditado', s: solRef(d.loanId), at: new Date((d.creditedAt ?? d.createdAt) as Date), amount: n(d.amount) })),
    ...(toSign ? [{ icon: 'gift' as const, t: 'Crédito aprobado listo para firmar', s: `${solRef(toSign.id)} · ${money(n(toSign.principal))} en ${toSign.term} cuotas`, at: new Date(toSign.updatedAt as Date) }] : []),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5)

  return (
    <>
      <PageHead
        title={`Hola, ${firstName}`}
        description={`Resumen financiero de tu cuenta al ${fdate(now)}`}
        actions={
          <div className="uc-cta-row" style={{ gap: 10 }}>
            <Badge tone={identityVerified ? 'success' : 'warning'}>
              {identityVerified ? 'Identidad verificada' : 'Identidad pendiente'}
            </Badge>
            <ButtonLink primary href="/dashboard/solicitar">
              <Icon name="plus" size="sm" />
              Pedir un crédito
            </ButtonLink>
          </div>
        }
      />

      {/* Tarjetas Principales */}
      <Grid cols="21">
        <Pad aria-labelledby="prox-t">
          <div className="uc-card-h">
            <h2 id="prox-t">Próxima cuota</h2>
            {next ? (
              <Badge tone={next.status === 'overdue' ? 'danger' : days <= 3 ? 'warning' : 'info'}>
                {next.status === 'overdue' ? 'Vencida' : days <= 3 ? `Vence en ${Math.max(days, 0)} días` : `Vence el ${fdate(next.dueDate as Date)}`}
              </Badge>
            ) : null}
          </div>
          {next ? (
            <>
              <div className="uc-big uc-num">{money(n(next.amount))}</div>
              <p className="uc-muted" style={{ margin: '6px 0 18px' }}>
                Cuota <b className="uc-num">{next.number}/{next.loanTerm}</b> · vencimiento <b className="uc-num">{fdate(next.dueDate as Date)}</b> · <span className="uc-num" style={{ whiteSpace: 'nowrap' }}>{solRef(next.loanId)}</span>
              </p>
              <div className="uc-cta-row">
                <ButtonLink primary large href={`/dashboard/pagos?pay=${next.id}`}>
                  <Icon name="wallet" size="sm" />
                  Pagar cuota ahora
                </ButtonLink>
                {next.status === 'overdue' ? (
                  <ButtonLink large href={`/dashboard/pagos/pago-parcial?loan=${next.loanId}`}>
                    Calculadora pago parcial
                  </ButtonLink>
                ) : (
                  <ButtonLink large href={`/dashboard/creditos/${next.loanId}`}>
                    Ver plan de cuotas
                  </ButtonLink>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="uc-big uc-num">Sin cuotas pendientes</div>
              <p className="uc-muted" style={{ margin: '6px 0 18px' }}>
                {loans.length ? 'Estás al día con todos tus compromisos.' : 'Cuando confirmes tu primer crédito, tu cronograma de cuotas aparecerá acá.'}
              </p>
              {!active.length ? (
                <div className="uc-cta-row">
                  <ButtonLink primary large href="/dashboard/solicitar">
                    <Icon name="plus" size="sm" />
                    Simular y pedir crédito
                  </ButtonLink>
                </div>
              ) : null}
            </>
          )}
        </Pad>

        <Pad>
          <div className="uc-card-h">
            <h2>Saldo adeudado</h2>
            <span className="uc-num">{active.length} crédito{active.length === 1 ? '' : 's'} activo{active.length === 1 ? '' : 's'}</span>
          </div>
          <div className="uc-big uc-num" style={{ fontSize: 28 }}>{money(debt)}</div>
          <div style={{ margin: '14px 0 8px' }}>
            <ProgressBar value={totalInst ? (paidInst / totalInst) * 100 : 0} label="Cuotas pagadas" />
          </div>
          <p className="uc-muted uc-small" style={{ margin: 0 }}>
            <b className="uc-num" style={{ color: 'var(--uc-text)' }}>{paidInst}</b> de <span className="uc-num">{totalInst}</span> cuotas pagadas
          </p>
        </Pad>
      </Grid>

      {/* Accesos Rápidos */}
      <SectionTitle title="Accesos rápidos" aside="Gestiones principales" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Mis créditos', sub: `${loans.length} registrados`, href: '/dashboard/creditos', icon: 'credit' as const },
          { label: 'Pagar una cuota', sub: 'Mercado Pago o Transf.', href: '/dashboard/pagos', icon: 'wallet' as const },
          { label: 'Pago parcial', sub: 'Calculá impacto en saldo', href: '/dashboard/pagos/pago-parcial', icon: 'wallet' as const },
          { label: 'Historial de pagos', sub: 'Comprobantes y recibos', href: '/dashboard/pagos/historial', icon: 'check' as const },
          { label: 'Documentos', sub: 'Contratos y pagarés', href: '/dashboard/documentos', icon: 'file' as const },
          { label: 'Cuentas para cobrar', sub: 'CBU / CVU titular', href: '/dashboard/perfil/cuentas', icon: 'clip' as const },
          { label: 'Informe BCRA', sub: 'Situación crediticia', href: '/dashboard/perfil/bcra', icon: 'user' as const },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="uc-card"
            style={{
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ color: 'var(--uc-text)', fontSize: 13.5 }}>{item.label}</b>
              <Icon name={item.icon} size="xs" style={{ color: 'var(--uc-accent)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>{item.sub}</span>
          </Link>
        ))}
      </div>

      {/* Tres Columnas Inferiores */}
      <Grid cols="3" className="uc-mt">
        <Pad className="uc-offer">
          <CardHead title="Línea precalificada" aside={<Icon name="gift" size="sm" />} />
          {lineReady && lineReady.amount > 0 ? (
            <>
              <p className="uc-muted" style={{ margin: 0 }}>Según tu perfil tenés disponible</p>
              <div className="uc-big uc-num" style={{ fontSize: 26, margin: '6px 0' }}>hasta {money(lineReady.amount)}</div>
              <p className="uc-muted uc-small" style={{ margin: '0 0 14px' }}>
                En hasta {lineReady.term} cuotas fijas en pesos. Sujeto a aprobación crediticia final.
              </p>
              <ButtonLink primary href="/dashboard/solicitar">
                Simular mi crédito
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="uc-muted" style={{ margin: '0 0 14px' }}>
                Completá tus datos personales y validá tu identidad para habilitar tu línea crediticia.
              </p>
              <ButtonLink primary href="/dashboard/perfil">
                Completar mis datos
              </ButtonLink>
            </>
          )}
        </Pad>

        <Pad>
          <CardHead title="Estado de tu cuenta" aside={<span>{steps.filter((s) => s.done).length} de {steps.length} listo</span>} />
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
          <CardHead title="Movimientos recientes" aside={<Link href="/dashboard/pagos/historial">Ver todos</Link>} />
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
            <p className="uc-note">Todavía no registrás pagos ni desembolsos.</p>
          )}
        </Pad>
      </Grid>
    </>
  )
}
