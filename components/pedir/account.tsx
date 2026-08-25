'use client'

import { acceptLoanContract } from '@/app/actions/documents'
import { PedirAppShell } from '@/components/pedir/app-shell'
import { PayInstallmentDialog } from '@/components/payments/pay-installment-dialog'
import { formatARS } from '@/lib/finance'
import { installmentStatusLabel, loanStatusLabel } from '@/lib/labels'
import { contractNeedsSignature } from '@/lib/loan-underwriting'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export type PedirAccountLoan = {
  id: string
  principal: string | number
  term: number
  installmentAmount: string | number
  status: string
  createdAt: Date | string
  scoreAtApproval: number | null
  contractId: string | null
  contractStatus: string | null
}

export type PedirAccountInstallment = {
  id: string
  loanId: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
}

export function PedirAccountClient({
  name,
  email,
  loans,
  installments,
  justSubmitted,
  mpStatus,
}: {
  name: string | null
  email: string | null
  loans: PedirAccountLoan[]
  installments: PedirAccountInstallment[]
  justSubmitted: boolean
  mpStatus: string | null
}) {
  const router = useRouter()
  const [payOpen, setPayOpen] = useState(false)
  const [selected, setSelected] = useState<PedirAccountInstallment | null>(null)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const activeLoanIds = new Set(loans.filter((l) => l.status === 'active').map((l) => l.id))
  const due = installments.filter(
    (i) => activeLoanIds.has(i.loanId) && (i.status === 'pending' || i.status === 'overdue'),
  )
  const next = due[0] ?? null
  const firstName = name?.split(' ')[0] ?? null
  const openLoan = loans.find((l) => l.status === 'pending' || l.status === 'approved' || l.status === 'active')
  const needsSign = loans.find((l) => l.status === 'approved' && contractNeedsSignature(l.contractStatus))
  const canRequestNew = !openLoan

  function acceptContract(contractId: string) {
    setMsg(null)
    setErr(null)
    start(async () => {
      try {
        await acceptLoanContract(contractId, {
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        })
        setMsg('Contrato firmado. El desembolso queda pendiente de tesorería.')
        router.refresh()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'No se pudo aceptar el contrato.')
      }
    })
  }

  return (
    <PedirAppShell title="Inicio" subtitle={email ?? undefined}>
      <div className="lp-app-hero-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="lp-status-chip bg-white/10 text-[var(--lp-signal)]">App UNICRÉDITOS</span>
        </div>
        <h2 className="lp-display mt-3 text-3xl sm:text-4xl">Hola{firstName ? `, ${firstName}` : ''}</h2>
        <p className="mt-2 max-w-md text-sm text-white/55">
          Tu centro operativo: solicitudes, firma de contrato y pago de cuotas.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {canRequestNew ? (
            <Link href="/pedir/solicitud" className="lp-btn lp-btn-primary py-2 text-sm">
              Pedir préstamo
            </Link>
          ) : null}
          {needsSign?.contractId ? (
            <button
              type="button"
              className="lp-btn lp-btn-primary py-2 text-sm"
              disabled={pending}
              onClick={() => acceptContract(needsSign.contractId!)}
            >
              Firmar contrato
            </button>
          ) : null}
          {next && openLoan?.status === 'active' ? (
            <button
              type="button"
              className="lp-btn lp-btn-ghost py-2 text-sm text-white"
              onClick={() => {
                setSelected(next)
                setPayOpen(true)
              }}
            >
              Pagar cuota
            </button>
          ) : null}
        </div>
      </div>

      {justSubmitted ? (
        <div className="lp-alert lp-alert-ok mt-4">
          Evaluación recibida. Si calificaste, firmá el contrato para habilitar el desembolso. Las cuotas se pagan cuando el crédito esté vigente.
        </div>
      ) : null}
      {needsSign ? (
        <div className="lp-alert lp-alert-warn mt-4">
          Tenés un crédito calificado pendiente de firma
          {needsSign.scoreAtApproval != null ? ` · score ${needsSign.scoreAtApproval}` : ''}. Revisá el contrato y firmalo
          para continuar.
        </div>
      ) : null}
      {mpStatus === 'success' ? (
        <div className="lp-alert lp-alert-ok mt-4">Pago recibido. La acreditación se confirma con el webhook de Mercado Pago.</div>
      ) : null}
      {mpStatus === 'pending' ? (
        <div className="lp-alert lp-alert-warn mt-4">Pago pendiente en Mercado Pago.</div>
      ) : null}
      {mpStatus === 'failure' ? (
        <div className="lp-alert lp-alert-err mt-4">El pago no se completó. Reintentá desde la cuota.</div>
      ) : null}
      {msg ? <div className="lp-alert lp-alert-ok mt-4">{msg}</div> : null}
      {err ? <div className="lp-alert lp-alert-err mt-4">{err}</div> : null}

      <div className="lp-account-grid mt-5">
        <div className="lp-app-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lp-muted)]">Créditos</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{loans.length}</p>
        </div>
        <div className="lp-app-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lp-muted)]">Próxima cuota</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{next ? formatARS(next.amount) : '—'}</p>
          <p className="mt-1 text-xs text-[var(--lp-muted)]">
            {next ? `Vence ${new Date(next.dueDate).toLocaleDateString('es-AR')}` : 'Sin pendientes'}
          </p>
        </div>
        <div className="lp-app-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lp-muted)]">Acción rápida</p>
          {needsSign?.contractId ? (
            <button
              type="button"
              className="lp-btn lp-btn-ink mt-3 w-full py-2 text-sm"
              disabled={pending}
              onClick={() => acceptContract(needsSign.contractId!)}
            >
              Firmar contrato
            </button>
          ) : (
            <button
              type="button"
              className="lp-btn lp-btn-ink mt-3 w-full py-2 text-sm"
              disabled={!next || openLoan?.status !== 'active'}
              onClick={() => {
                if (!next) return
                setSelected(next)
                setPayOpen(true)
              }}
            >
              {openLoan?.status === 'active' && next ? 'Pagar ahora' : 'Nada por pagar'}
            </button>
          )}
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--lp-ink)]">Créditos</h3>
          {canRequestNew ? (
            <Link href="/pedir/solicitud" className="text-sm font-semibold text-[var(--lp-mint-deep)]">
              Nuevo
            </Link>
          ) : (
            <span className="text-xs text-[var(--lp-muted)]">Un crédito abierto a la vez</span>
          )}
        </div>
        <div className="space-y-3">
          {loans.length === 0 ? (
            <div className="lp-app-panel text-sm text-[var(--lp-muted)]">
              Todavía no tenés solicitudes.{' '}
              <Link href="/pedir/solicitud" className="font-semibold text-[var(--lp-mint-deep)] underline">
                Empezá acá
              </Link>
              .
            </div>
          ) : (
            loans.map((loan) => (
              <article key={loan.id} className="lp-app-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--lp-ink)]">
                    {formatARS(loan.principal)} · {loan.term} cuotas
                  </p>
                  <p className="mt-1 text-sm text-[var(--lp-muted)]">
                    {loanStatusLabel(loan.status)}
                    {loan.scoreAtApproval != null ? ` · score ${loan.scoreAtApproval}` : ''}
                    {loan.status === 'approved' && contractNeedsSignature(loan.contractStatus)
                      ? ' · pendiente de firma'
                      : ''}
                    {loan.status === 'approved' && loan.contractStatus === 'accepted'
                      ? ' · firmado · espera desembolso'
                      : ''}
                    {' · '}
                    cuota {formatARS(loan.installmentAmount)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--lp-muted)]">#{loan.id.slice(-10)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loan.contractId && contractNeedsSignature(loan.contractStatus) ? (
                    <button
                      type="button"
                      className="lp-btn lp-btn-primary py-2 text-sm"
                      disabled={pending}
                      onClick={() => acceptContract(loan.contractId!)}
                    >
                      Firmar
                    </button>
                  ) : null}
                  {loan.contractId ? (
                    <Link href={`/pedir/docs/contrato/${loan.contractId}`} className="lp-btn lp-btn-ghost py-2 text-sm text-[var(--lp-ink)]">
                      Contrato
                    </Link>
                  ) : null}
                  {loan.contractId ? (
                    <Link href={`/pedir/docs/pagare/${loan.contractId}`} className="lp-btn lp-btn-ghost py-2 text-sm text-[var(--lp-ink)]">
                      Pagaré
                    </Link>
                  ) : null}
                  <Link href={`/pedir/docs/cuponera/${loan.id}`} className="lp-btn lp-btn-ghost py-2 text-sm text-[var(--lp-ink)]">
                    Cuponera
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-lg font-semibold text-[var(--lp-ink)]">Cuotas</h3>
        <div className="overflow-x-auto rounded-[1.25rem] border border-[var(--lp-line)] bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--lp-line)] text-[11px] uppercase tracking-[0.1em] text-[var(--lp-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Vencimiento</th>
                <th className="px-4 py-3 font-semibold text-right">Monto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {installments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--lp-muted)]">
                    Sin cuotas todavía.
                  </td>
                </tr>
              ) : (
                    installments.slice(0, 24).map((row) => {
                      const parent = loans.find((l) => l.id === row.loanId)
                      const payable =
                        parent?.status === 'active' && (row.status === 'pending' || row.status === 'overdue')
                      return (
                    <tr key={row.id} className="border-b border-[var(--lp-line)] last:border-0">
                      <td className="px-4 py-3 font-mono">{row.number}</td>
                      <td className="px-4 py-3">{new Date(row.dueDate).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatARS(row.amount)}</td>
                      <td className="px-4 py-3">{installmentStatusLabel(row.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {payable ? (
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--lp-mint-deep)] hover:underline"
                            onClick={() => {
                              setSelected(row)
                              setPayOpen(true)
                            }}
                          >
                            Pagar
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <PayInstallmentDialog
          open={payOpen}
          onClose={() => {
            setPayOpen(false)
            setSelected(null)
            router.refresh()
          }}
          email={email}
          payPathPrefix="/pedir/pagar"
          returnPath="/pedir/cuenta"
          installments={[selected]}
        />
      ) : null}
    </PedirAppShell>
  )
}
