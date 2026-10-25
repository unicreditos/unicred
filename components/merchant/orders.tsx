'use client'

import { cancelMerchantOrder, confirmOrderDelivery } from '@/app/actions/merchant-commerce'
import { btnGhost, btnPrimary, Empty, fieldClass, fmtDate, StagePill, type Commerce, type CommerceOrder } from '@/components/merchant/shared'
import { formatARS } from '@/lib/finance'
import { DOWN_PAYMENT_LABEL, formatPayDate, ORDER_STAGE_LABEL, type DownPaymentStatus, type OrderStage } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, PackageCheck, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const FILTERS: Array<{ id: 'todas' | OrderStage; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'lista_para_entregar', label: 'Para entregar' },
  { id: 'esperando_cliente', label: 'Esperando cliente' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'entregada', label: 'A liquidar' },
  { id: 'liquidada', label: 'Liquidadas' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'anulada', label: 'Anuladas' },
]

function NextStep({ o }: { o: CommerceOrder }) {
  const text: Record<OrderStage, string> = {
    en_revision: 'La mesa de créditos está revisando la operación. No entregues el producto.',
    esperando_cliente: [
      !o.contractSigned ? 'falta que el cliente firme el contrato' : null,
      o.downPaymentStatus !== 'confirmed'
        ? `anticipo: ${(DOWN_PAYMENT_LABEL[o.downPaymentStatus as DownPaymentStatus] ?? o.downPaymentStatus).toLowerCase()}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')
      .replace(/^./, (c) => c.toUpperCase()) + '. Todavía no entregues el producto.',
    lista_para_entregar: 'Firmó y pagó el anticipo. Entregá el producto y cargá el código de 6 dígitos que el cliente ve en su cuenta.',
    entregada: o.settlementPayDate ? `Entregada el ${fmtDate(o.deliveredAt)}. Se liquida el ${formatPayDate(o.settlementPayDate)}.` : 'Entregada.',
    liquidada: `Liquidada${o.settlementPayDate ? ` el ${formatPayDate(o.settlementPayDate)}` : ''}.`,
    rechazada: `La mesa no aprobó la operación${o.rejectionReason ? `: ${o.rejectionReason}` : '.'}`,
    anulada: `Anulada${o.cancelReason ? `: ${o.cancelReason}` : '.'}`,
  }
  return <p className="text-sm text-muted-foreground">{text[o.stage]}</p>
}

function OrderRow({ o }: { o: CommerceOrder }) {
  const router = useRouter()
  const [open, setOpen] = useState(o.stage === 'lista_para_entregar')
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [pending, start] = useTransition()
  const canCancel = !o.deliveredAt && !o.cancelledAt && o.stage !== 'rechazada' && o.downPaymentStatus !== 'confirmed'

  return (
    <li className={cn('rounded-2xl border bg-card', o.stage === 'lista_para_entregar' ? 'border-emerald-500/60 shadow-sm' : 'border-border')}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left">
        <span className="font-mono text-sm font-bold">{o.code}</span>
        <span className="order-last min-w-0 basis-full truncate text-sm sm:order-none sm:basis-0 sm:flex-1">
          <b>{o.customerName ?? 'Cliente'}</b>
          <span className="text-muted-foreground"> · {o.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(', ')}</span>
        </span>
        <span className="ml-auto font-mono text-sm font-semibold tabular-nums sm:ml-0">{formatARS(o.totalAmount)}</span>
        <StagePill stage={o.stage} />
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div className="grid gap-5 border-t border-border p-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <NextStep o={o} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Cargada</dt><dd>{fmtDate(o.createdAt)} · {o.origin === 'online' ? 'pedido online' : 'en el local'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">CUIL</dt><dd className="font-mono">{o.customerCuil ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Anticipo (a UNICRÉDITOS)</dt><dd className="font-mono">{formatARS(o.downPaymentAmount)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Financiado</dt><dd className="font-mono">{formatARS(o.financedAmount)} · {o.term} cuotas</dd></div>
              <div><dt className="text-xs text-muted-foreground">Comisión</dt><dd className="font-mono">− {formatARS(o.commissionAmount)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">A cobrar</dt><dd className="font-mono font-semibold">{formatARS(o.netAmount)}</dd></div>
            </dl>
          </div>
          <div className="space-y-3">
            {o.stage === 'lista_para_entregar' ? (
              <form
                className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"
                onSubmit={(e) => {
                  e.preventDefault()
                  start(async () => {
                    const r = await confirmOrderDelivery({ orderId: o.id, code })
                    if (r.ok) {
                      toast.success(`Entrega registrada. Se liquida el ${r.data ? formatPayDate(r.data.payDate) : 'viernes'}.`)
                      router.refresh()
                    } else toast.error(r.error)
                  })
                }}
              >
                <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Código de entrega del cliente
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                    className={cn(fieldClass, 'mt-1 text-center font-mono text-xl tracking-[0.4em]')}
                    placeholder="••••••"
                    aria-label="Código de entrega de 6 dígitos"
                  />
                </label>
                <button type="submit" disabled={pending || code.length !== 6} className={cn(btnPrimary, 'mt-3 w-full')}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageCheck className="h-4 w-4" aria-hidden />}
                  Confirmar entrega
                </button>
              </form>
            ) : null}
            {canCancel ? (
              cancelling ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    start(async () => {
                      const r = await cancelMerchantOrder({ orderId: o.id, reason })
                      if (r.ok) {
                        toast.success('Operación anulada')
                        router.refresh()
                      } else toast.error(r.error)
                    })
                  }}
                >
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} placeholder="Motivo de la anulación" minLength={5} required />
                  <div className="flex gap-2">
                    <button type="submit" disabled={pending} className={cn(btnGhost, 'border-rose-300 text-rose-700')}>Anular operación</button>
                    <button type="button" className={btnGhost} onClick={() => setCancelling(false)}>Volver</button>
                  </div>
                </form>
              ) : (
                <button type="button" className="text-xs font-semibold text-rose-700 underline dark:text-rose-400" onClick={() => setCancelling(true)}>
                  Anular operación
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function OrdersTab({ data }: { data: Commerce }) {
  const [filter, setFilter] = useState<'todas' | OrderStage>(() => (data.orders.some((o) => o.stage === 'lista_para_entregar') ? 'lista_para_entregar' : 'todas'))
  const [q, setQ] = useState('')
  const count = (id: 'todas' | OrderStage) => (id === 'todas' ? data.orders.length : data.orders.filter((o) => o.stage === id).length)
  const t = q.trim().toLowerCase()
  const rows = data.orders.filter(
    (o) => (filter === 'todas' || o.stage === filter) && (!t || `${o.code} ${o.customerName ?? ''} ${o.customerCuil ?? ''}`.toLowerCase().includes(t)),
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por etapa">
        {FILTERS.filter((f) => f.id === 'todas' || count(f.id) > 0).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold', filter === f.id ? 'border-brand-navy-900 bg-brand-navy-900 text-white dark:border-brand-primary dark:bg-brand-primary' : 'border-border')}
          >
            {f.label} <span className="ml-1 font-mono text-xs opacity-70">{count(f.id)}</span>
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'pl-9')} placeholder="Buscar por código, cliente o CUIL" aria-label="Buscar operación" />
      </div>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </ul>
      ) : (
        <Empty title={data.orders.length ? `Sin operaciones ${filter === 'todas' ? '' : `“${ORDER_STAGE_LABEL[filter as OrderStage]}”`}` : 'Todavía no cargaste ventas en cuotas'}>
          {data.orders.length ? null : 'Usá Nueva venta para armar la primera con productos de tu catálogo.'}
        </Empty>
      )}
    </div>
  )
}
