'use client'

import {
  adminCancelNetworkTicket,
  adminCancelOpenNetworkTickets,
  adminReconcileMercadoPago,
  adminRegisterCollection,
  type AdminOpsDesk,
  type OpsInstallment,
  type OpsOpenTicket,
} from '@/app/actions/admin-ops'
import { TransferReviews } from '@/components/admin/transfer-reviews'
import { ArcaInvoicesDesk } from '@/components/admin/arca-invoices-desk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { adminUrl } from '@/lib/admin-nav'
import { formatOperationNumber } from '@/lib/coupon'
import { formatARS } from '@/lib/finance'
import { installmentStatusLabel, loanStatusLabel, paymentMethodLabel, paymentStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { ExternalLink, ReceiptText } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortLoan(id: string | null | undefined) {
  if (!id) return '—'
  const clean = id.replace(/^loan_/, '')
  return clean.length > 12 ? `${clean.slice(0, 4)}…${clean.slice(-4)}` : clean
}

function CollectDialog({ row, onDone }: { row: OpsInstallment; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (row.status === 'paid') return null
  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        Registrar cobro
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              setBusy(true)
              void adminRegisterCollection({
                installmentId: row.id,
                amount: Number(data.get('amount')),
                method: String(data.get('method')) as 'transferencia_rm' | 'efectivo' | 'mercado_pago' | 'payway_qr',
                reference: String(data.get('reference') || ''),
                notes: String(data.get('notes') || ''),
              })
                .then((res) => {
                  toast.success(`Cobro acreditado · ${res.receiptNumber}`)
                  setOpen(false)
                  onDone()
                })
                .catch((err) => toast.error((err as Error).message))
                .finally(() => setBusy(false))
            }}
          >
            <div>
              <p className="text-sm font-semibold text-brand-navy-900">Registrar cobro</p>
              <p className="text-xs text-slate-500">
                {row.customerName} · cuota #{row.number} · {formatARS(row.amount)}
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-600">
              Monto acreditado
              <Input name="amount" type="number" step="0.01" min="0" defaultValue={row.amount} className="mt-1" required />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Medio
              <select name="method" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm" defaultValue="transferencia_rm">
                <option value="transferencia_rm">Transferencia a tesorería RM</option>
                <option value="efectivo">Efectivo</option>
                <option value="mercado_pago">Mercado Pago</option>
                <option value="payway_qr">Payway (sandbox)</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Referencia / CBU / ID
              <Input name="reference" className="mt-1" placeholder="Nº de operación" />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Nota interna
              <Input name="notes" className="mt-1" placeholder="Opcional" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? 'Acreditando…' : 'Acreditar y emitir recibo'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}

function OpenNetworkTickets({ desk }: { desk: AdminOpsDesk }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const tickets = desk.openTickets

  function run(label: string, task: () => Promise<{ message: string }>) {
    setBusy(label)
    void task()
      .then((res) => {
        toast.success(res.message)
        router.refresh()
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => {
        setBusy(null)
        setConfirmAll(false)
      })
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy-900">Cupones de Pago Fácil / Rapipago</h2>
          <p className="text-xs text-slate-500">
            Códigos de barras y Nº de operación ya emitidos, todavía no cobrados. Mercado Pago avisa solo cuando el cliente paga; también podés conciliar ahora. Anular invalida el talón impreso.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={busy !== null}
            onClick={() =>
              run('reconcile', async () => {
                const res = await adminReconcileMercadoPago()
                return {
                  message:
                    res.credited > 0
                      ? `Conciliación lista · ${res.credited} cobro${res.credited === 1 ? '' : 's'} acreditado${res.credited === 1 ? '' : 's'} de ${res.scanned} revisados`
                      : `Conciliación lista · ningún cobro nuevo en ${res.scanned} pendientes`,
                }
              })
            }
          >
            {busy === 'reconcile' ? 'Conciliando…' : 'Conciliar Mercado Pago ahora'}
          </Button>
          {tickets.length > 0 ? (
            <Button size="sm" variant="outline" className="h-8 text-rose-700" disabled={busy !== null} onClick={() => setConfirmAll(true)}>
              Anular todos los cupones abiertos
            </Button>
          ) : null}
        </div>
      </header>
      {confirmAll ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-amber-950">
            Vas a anular {tickets.length} cupón{tickets.length === 1 ? '' : 'es'} de red.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Los códigos de barras, Nº de operación y tickets de Pago Fácil / Rapipago impresos dejan de servir. Los recibos ya cobrados no se tocan. Si Mercado Pago ya acreditó alguno, se concilia en vez de anularlo.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmAll(false)} disabled={busy !== null}>
              Volver
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-rose-700 hover:bg-rose-800"
              disabled={busy !== null}
              onClick={() =>
                run('cancel-all', async () => {
                  const res = await adminCancelOpenNetworkTickets()
                  const parts = [`${res.cancelled} anulado${res.cancelled === 1 ? '' : 's'}`]
                  if (res.settled) parts.push(`${res.settled} ya estaba cobrado y se acreditó`)
                  if (res.errors) parts.push(`${res.errors} no se pudieron anular`)
                  return { message: parts.join(' · ') }
                })
              }
            >
              {busy === 'cancel-all' ? 'Anulando…' : 'Sí, anular cupones abiertos'}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Red</th>
              <th className="px-4 py-2">Nº de operación</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2">Vence</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay cupones de Pago Fácil / Rapipago pendientes. Los cobros reales aparecen en Movimientos cuando Mercado Pago confirma el pago.
                </td>
              </tr>
            ) : (
              tickets.slice(0, 200).map((row: OpsOpenTicket) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={adminUrl('usuarios', row.userId)} className="font-medium text-brand-navy-900 hover:underline">
                      {row.customerName}
                    </Link>
                    <p className="font-mono text-[11px] text-slate-400">{shortLoan(row.loanId)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{paymentMethodLabel(row.method)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.operationNumber ? formatOperationNumber(row.operationNumber) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatARS(row.amount)}</td>
                  <td className="px-4 py-3 text-xs">{fmtDate(row.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-rose-700"
                      disabled={busy !== null}
                      onClick={() =>
                        run(row.id, async () => {
                          const res = await adminCancelNetworkTicket(row.id)
                          return {
                            message:
                              res.outcome === 'settled'
                                ? 'Ese cupón ya estaba cobrado en Mercado Pago: se acreditó en tesorería'
                                : 'Cupón anulado. El código de barras y el Nº de operación dejan de servir.',
                          }
                        })
                      }
                    >
                      {busy === row.id ? 'Anulando…' : 'Anular'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function CobranzasDesk({ desk }: { desk: AdminOpsDesk }) {
  const router = useRouter()
  const [filter, setFilter] = useState<'overdue' | 'due7' | 'paid' | 'all'>('overdue')
  const now = new Date(desk.generatedAt).getTime()
  const rows = useMemo(() => {
    return desk.installments.filter((row) => {
      if (filter === 'all') return true
      if (filter === 'paid') return row.status === 'paid'
      if (filter === 'overdue') return row.status === 'overdue'
      const due = new Date(row.dueDate).getTime()
      return row.status !== 'paid' && row.status !== 'cancelled' && due >= now && due <= now + 7 * 86_400_000
    })
  }, [desk.installments, filter, now])

  return (
    <OpsFloor>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2',
          desk.kpis.overdueCount ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
        )}
      >
        <div>
          <p className="text-[13px] font-semibold">
            {desk.kpis.overdueCount ? `${desk.kpis.overdueCount} cuotas en mora` : 'Cartera al día'}
          </p>
          <p className="text-[11px] text-slate-600">
            {desk.kpis.pendingReview} transferencias a verificar · {desk.kpis.openTickets} cupones de red · {desk.kpis.due7Count} vencen en 7 días
          </p>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-5">
        <MetricTile label="Mora" value={formatARS(desk.kpis.overdueAmount)} hint={`${desk.kpis.overdueCount} cuotas`} tone={desk.kpis.overdueCount ? 'critical' : 'ok'} />
        <MetricTile label="Vence 7 días" value={formatARS(desk.kpis.due7Amount)} hint={`${desk.kpis.due7Count} cuotas`} tone={desk.kpis.due7Count ? 'warn' : 'ok'} />
        <MetricTile label="Cobrado mes" value={formatARS(desk.kpis.collectedMonth)} hint={`${desk.kpis.receiptsMonth} recibos`} />
        <MetricTile label="A verificar" value={String(desk.kpis.pendingReview)} hint="RM / Brubank" tone={desk.kpis.pendingReview ? 'warn' : 'ok'} />
        <MetricTile label="Cupones" value={String(desk.kpis.openTickets)} hint="Pago Fácil / Rapipago" tone={desk.kpis.openTickets ? 'warn' : 'ok'} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-8">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Mesa de cobranzas</h2>
            <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-0.5">
              {(
                [
                  ['overdue', 'Vencidas'],
                  ['due7', '7 días'],
                  ['paid', 'Cobradas'],
                  ['all', 'Todas'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    'h-7 rounded px-2 text-[11px] font-medium',
                    filter === id ? 'bg-brand-navy-900 text-white' : 'text-slate-600 hover:bg-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">Cliente</th>
                  <th className="px-3 py-1.5">Crédito</th>
                  <th className="px-3 py-1.5">Cuota</th>
                  <th className="px-3 py-1.5">Vence</th>
                  <th className="px-3 py-1.5 text-right">Monto</th>
                  <th className="px-3 py-1.5">Estado</th>
                  <th className="px-3 py-1.5">Último pago</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No hay cuotas en este filtro.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 200).map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-brand-navy-900">{row.customerName}</p>
                        <p className="text-[10px] text-slate-500">{row.customerEmail}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{shortLoan(row.loanId)}</td>
                      <td className="px-3 py-2">#{row.number}</td>
                      <td className="px-3 py-2">
                        <p>{fmtDate(row.dueDate)}</p>
                        {row.daysLate > 0 ? <p className="text-[10px] text-rose-600">{row.daysLate} d atraso</p> : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatARS(row.amount)}</td>
                    <td className="px-4 py-3">
                      <p className={cn('text-xs font-medium', row.status === 'overdue' ? 'text-rose-700' : row.status === 'paid' ? 'text-emerald-700' : 'text-slate-600')}>
                        {installmentStatusLabel(row.status)}
                      </p>
                      <p className="text-[11px] text-slate-400">{loanStatusLabel(row.loanStatus)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.lastReceiptNumber ? (
                        <a className="font-medium text-brand-primary hover:underline" href={`/dashboard/documentos/recibo/${row.lastReceiptId}`} target="_blank" rel="noreferrer">
                          {row.lastReceiptNumber}
                        </a>
                      ) : (
                        'Sin recibo'
                      )}
                      <p className="text-[11px] text-slate-400">{fmtDate(row.lastPaidAt)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
                          <Link href={adminUrl('usuarios', row.userId)}>Cuenta</Link>
                        </Button>
                        <CollectDialog row={row} onDone={() => router.refresh()} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </section>
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden lg:col-span-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
            <OpenNetworkTickets desk={desk} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-1.5">
              <h2 className="text-[12px] font-semibold">Transferencias informadas</h2>
            </div>
            <TransferReviews />
          </div>
        </div>
      </div>
    </OpsFloor>
  )
}

export function ComprobantesDesk({ desk }: { desk: AdminOpsDesk }) {
  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
        <MetricTile label="Recibos este mes" value={String(desk.kpis.receiptsMonth)} hint="Pagos y desembolsos emitidos" />
        <MetricTile label="Cobrado este mes" value={formatARS(desk.kpis.collectedMonth)} />
        <MetricTile label="Archivo" value={String(desk.receipts.length)} hint="Últimos comprobantes" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-7">
          <header className="shrink-0 border-b border-slate-100 px-3 py-1.5">
            <h2 className="text-[12px] font-semibold text-brand-navy-900">Comprobantes</h2>
            <p className="text-[10px] text-slate-500">Mismo talón que ve el cliente</p>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">Número</th>
                  <th className="px-3 py-1.5">Cliente</th>
                  <th className="px-3 py-1.5">Tipo</th>
                  <th className="px-3 py-1.5">Medio</th>
                  <th className="px-3 py-1.5 text-right">Monto</th>
                  <th className="px-3 py-1.5">Fecha</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {desk.receipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Todavía no hay comprobantes emitidos.
                    </td>
                  </tr>
                ) : (
                  desk.receipts.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 font-mono text-[11px]">{row.receiptNumber}</td>
                      <td className="px-3 py-2">
                        <Link href={adminUrl('usuarios', row.userId)} className="font-medium text-brand-navy-900 hover:underline">
                          {row.customerName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[11px]">{row.statusHint}</td>
                      <td className="px-3 py-2 text-[11px]">{paymentMethodLabel(row.method)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatARS(row.amount)}</td>
                      <td className="px-3 py-2 text-[11px]">{fmtDate(row.paidAt || row.issuedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <a href={row.href} target="_blank" rel="noreferrer">
                            <ReceiptText className="h-3.5 w-3.5" /> Ver
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div className="min-h-0 overflow-auto lg:col-span-5">
          <ArcaInvoicesDesk />
        </div>
      </div>
    </OpsFloor>
  )
}

export function MovimientosDesk({ desk }: { desk: AdminOpsDesk }) {
  return (
    <OpsFloor>
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-[12px] font-semibold">Cuenta corriente operativa</p>
        <p className="text-[11px] text-slate-500">
          Cobros acreditados, devoluciones, rechazos, desembolsos y cuotas vencidas. Los cupones de red viven en Cobranzas hasta que se pagan o se anulan.
        </p>
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="shrink-0 border-b border-slate-100 px-3 py-1.5">
          <h2 className="text-[12px] font-semibold text-brand-navy-900">Historial de movimientos</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto divide-y divide-slate-100">
          {desk.movements.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Sin movimientos cargados.</p>
          ) : (
            desk.movements.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-brand-navy-900">{row.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {row.customerName} · {shortLoan(row.loanId)} · {fmtDate(row.at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('font-mono text-[13px] tabular-nums', row.kind === 'desembolso' ? 'text-emerald-700' : row.status === 'overdue' ? 'text-rose-700' : 'text-brand-navy-900')}>
                    {row.kind === 'desembolso' ? '+' : row.kind === 'pago' ? '−' : ''}
                    {formatARS(row.amount)}
                  </p>
                  <p className="text-[10px] text-slate-500">{paymentStatusLabel(row.status) === '—' ? row.status : paymentStatusLabel(row.status)}</p>
                  {row.href ? (
                    <Link href={row.href} className="text-[11px] font-medium text-brand-primary hover:underline">
                      Abrir
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </OpsFloor>
  )
}

export function LegalesDesk({ desk }: { desk: AdminOpsDesk }) {
  return (
    <OpsFloor>
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-[12px] font-semibold">Archivo legal</p>
        <p className="text-[11px] text-slate-500">
          Contratos de mutuo, pagarés y expediente. La intimación de mora se emite desde la ficha del cliente.
        </p>
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="shrink-0 border-b border-slate-100 px-3 py-1.5">
          <h2 className="text-[12px] font-semibold text-brand-navy-900">Contratos</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-1.5">Cliente</th>
                <th className="px-3 py-1.5">Crédito</th>
                <th className="px-3 py-1.5 text-right">Capital</th>
                <th className="px-3 py-1.5">Estado</th>
                <th className="px-3 py-1.5">Aceptado</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {desk.contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Todavía no hay contratos emitidos.
                  </td>
                </tr>
              ) : (
                desk.contracts.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <Link href={adminUrl('usuarios', row.userId)} className="font-medium hover:underline">
                        {row.customerName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{shortLoan(row.loanId)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatARS(row.principal)}</td>
                    <td className="px-3 py-2 text-[11px]">{row.status === 'accepted' ? 'Firmado' : row.status === 'generated' ? 'Pendiente de firma' : row.status}</td>
                    <td className="px-3 py-2 text-[11px]">{fmtDate(row.acceptedAt || row.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <a href={row.contractHref} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" /> Contrato
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="h-7">
                          <a href={row.pagareHref} target="_blank" rel="noreferrer">
                            Pagaré
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </OpsFloor>
  )
}
