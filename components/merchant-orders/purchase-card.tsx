'use client'

import { createDownPaymentQr, reportDownPayment } from '@/app/actions/merchant-order-customer'
import { formatARS } from '@/lib/finance'
import { DOWN_PAYMENT_LABEL, ORDER_STAGE_LABEL, type DownPaymentStatus, type OrderStage } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { Check, Copy, Loader2, QrCode, Store, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

export type PurchaseOrder = {
  id: string
  code: string
  loanId: string
  contractId: string | null
  merchantName: string
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>
  totalAmount: string
  downPaymentAmount: string
  financedAmount: string
  term: number
  installmentAmount: number
  stage: OrderStage
  loanStatus: string
  contractSigned: boolean
  downPaymentStatus: string
  downPaymentNote: string | null
  deliveryCode: string | null
  deliveredAt: Date | string | null
  qr: { data: string; expiresAt: Date | string } | null
  pendingSteps: string[]
}

export type TreasuryInfo = { bank: string; holder: string; cuit: string; cbu: string; alias: string | null; accountType: string }

const STAGE_TONE: Record<OrderStage, string> = {
  en_revision: 'bg-sky-50 text-sky-800 ring-sky-200',
  esperando_cliente: 'bg-amber-50 text-amber-900 ring-amber-200',
  lista_para_entregar: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  entregada: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  liquidada: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rechazada: 'bg-rose-50 text-rose-800 ring-rose-200',
  anulada: 'bg-slate-100 text-slate-700 ring-slate-200',
}

function Step({ done, active, n, label }: { done: boolean; active: boolean; n: number; label: string }) {
  return (
    <li className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          done ? 'bg-emerald-600 text-white' : active ? 'bg-brand-navy-900 text-white' : 'bg-slate-200 text-slate-600',
        )}
      >
        {done ? <Check className="h-4 w-4" aria-hidden /> : n}
      </span>
      <span className={cn('truncate text-xs font-semibold', done || active ? 'text-slate-900' : 'text-slate-500')}>{label}</span>
    </li>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate font-mono text-sm font-semibold text-slate-900">{value}</div>
      </div>
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copiado`)).catch(() => {})
        }}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
      </button>
    </div>
  )
}

function QrBox({ data }: { data: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(data, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [data])
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR de Mercado Pago para pagar el anticipo" width={240} height={240} className="mx-auto rounded-xl bg-white p-2 ring-1 ring-slate-200" />
  ) : (
    <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-xl bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
    </div>
  )
}

function DownPaymentBox({ order, treasury }: { order: PurchaseOrder; treasury: TreasuryInfo }) {
  const router = useRouter()
  const [tab, setTab] = useState<'qr' | 'transfer'>('qr')
  const [qr, setQr] = useState(order.qr)
  const [pending, start] = useTransition()

  if (order.downPaymentStatus === 'confirmed') {
    return <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Anticipo acreditado. ¡Gracias!</p>
  }
  if (order.downPaymentStatus === 'reported') {
    return (
      <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
        Recibimos tu comprobante. Tesorería acredita el anticipo cuando ve el dinero en la cuenta (hasta 48 h hábiles). Te avisamos por mail.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {order.downPaymentStatus === 'rejected' ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          No pudimos acreditar el comprobante anterior{order.downPaymentNote ? `: ${order.downPaymentNote}` : '.'} Volvé a informarlo o pagá con QR.
        </p>
      ) : null}
      <div className="inline-flex rounded-full bg-slate-100 p-1" role="tablist" aria-label="Medio de pago del anticipo">
        {(['qr', 'transfer'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
          >
            {t === 'qr' ? 'QR Mercado Pago' : 'Transferencia'}
          </button>
        ))}
      </div>

      {tab === 'qr' ? (
        <div className="space-y-3 text-center">
          {qr ? (
            <>
              <QrBox data={qr.data} />
              <p className="text-xs text-slate-600">
                Escaneá con Mercado Pago o la app de tu banco. Importe exacto: <b>{formatARS(order.downPaymentAmount)}</b>. Se acredita solo en minutos.
              </p>
              <button type="button" className="text-xs font-semibold text-brand-primary-700 underline" onClick={() => router.refresh()}>
                Ya pagué: actualizar estado
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createDownPaymentQr(order.id)
                  if (r.ok) setQr(r.qr)
                  else {
                    toast.error(r.error)
                    setTab('transfer')
                  }
                })
              }
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-navy-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="h-4 w-4" aria-hidden />}
              Generar QR por {formatARS(order.downPaymentAmount)}
            </button>
          )}
        </div>
      ) : (
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              fd.set('orderId', order.id)
              const r = await reportDownPayment(fd)
              if (r.ok) {
                toast.success('Comprobante enviado. Te avisamos cuando se acredite.')
                router.refresh()
              } else toast.error(r.error)
            })
          }
        >
          <p className="text-sm text-slate-700">
            Transferí exactamente <b>{formatARS(order.downPaymentAmount)}</b> a la cuenta de UNICRÉDITOS. No le pagues el anticipo al comercio.
          </p>
          <div className="rounded-xl border border-slate-200 bg-white px-3">
            <CopyRow label="CBU" value={treasury.cbu} />
            {treasury.alias ? <CopyRow label="Alias" value={treasury.alias} /> : null}
            <CopyRow label="Titular" value={`${treasury.holder} · CUIT ${treasury.cuit}`} />
            <CopyRow label="Banco" value={`${treasury.bank} · ${treasury.accountType}`} />
            <CopyRow label="Concepto" value={`Anticipo ${order.code}`} />
          </div>
          <label className="block text-sm font-medium text-slate-800">
            Número de operación de la transferencia
            <input name="reference" required minLength={4} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm" placeholder="Ej.: 000123456789" />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Comprobante (PDF o imagen, hasta 1,5 MB)
            <input name="proof" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-navy-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            Informar transferencia
          </button>
        </form>
      )}
    </div>
  )
}

export function PurchaseCard({ order, treasury }: { order: PurchaseOrder; treasury: TreasuryInfo }) {
  const approved = !['en_revision', 'rechazada', 'anulada'].includes(order.stage)
  const signed = order.contractSigned
  const paid = order.downPaymentStatus === 'confirmed'
  const delivered = Boolean(order.deliveredAt)
  const closed = order.stage === 'rechazada' || order.stage === 'anulada'
  return (
    <article className="uc-card overflow-hidden" data-testid={`compra-${order.code}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary-50 text-brand-primary-700">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">Compra en {order.merchantName}</h3>
            <p className="font-mono text-xs text-slate-500">{order.code}</p>
          </div>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1', STAGE_TONE[order.stage])}>{ORDER_STAGE_LABEL[order.stage]}</span>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <ul className="space-y-1 text-sm text-slate-700">
            {order.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{i.quantity > 1 ? `${i.quantity}× ` : ''}{i.name}</span>
                <span className="font-mono tabular-nums">{formatARS(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div><dt className="text-xs text-slate-500">Precio</dt><dd className="font-mono font-semibold tabular-nums">{formatARS(order.totalAmount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Anticipo 30%</dt><dd className="font-mono font-semibold tabular-nums">{formatARS(order.downPaymentAmount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Financiado</dt><dd className="font-mono font-semibold tabular-nums">{formatARS(order.financedAmount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Cuotas</dt><dd className="font-mono font-semibold tabular-nums">{order.term} × {formatARS(order.installmentAmount)}</dd></div>
          </dl>
          {!closed ? (
            <ol className="flex gap-2" aria-label="Pasos de la compra">
              <Step n={1} label="Aprobación" done={approved} active={!approved} />
              <Step n={2} label="Firma" done={signed} active={approved && !signed} />
              <Step n={3} label="Anticipo" done={paid} active={approved && !paid} />
              <Step n={4} label="Retiro" done={delivered} active={order.stage === 'lista_para_entregar'} />
            </ol>
          ) : null}
        </div>

        <div className="space-y-3">
          {order.stage === 'en_revision' ? (
            <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
              Una persona de la mesa de créditos revisa tu compra. Te avisamos por mail. Todavía no pagues nada.
            </p>
          ) : null}
          {order.stage === 'rechazada' ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">La mesa no aprobó esta compra en cuotas.</p> : null}
          {order.stage === 'anulada' ? <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">La operación se anuló.</p> : null}

          {order.stage === 'esperando_cliente' ? (
            <>
              {!signed ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">Firmá el contrato y el pagaré del crédito.</p>
                  <Link
                    href={order.contractId ? `/dashboard/documentos?doc=contrato&docId=${encodeURIComponent(order.contractId)}` : '/dashboard/documentos'}
                    className="inline-flex h-10 items-center rounded-full bg-brand-navy-900 px-4 text-sm font-semibold text-white"
                  >
                    Firmar ahora
                  </Link>
                </div>
              ) : null}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">Anticipo del 30%</h4>
                  <span className="text-xs font-semibold text-slate-600">{DOWN_PAYMENT_LABEL[order.downPaymentStatus as DownPaymentStatus] ?? order.downPaymentStatus}</span>
                </div>
                <DownPaymentBox order={order} treasury={treasury} />
              </div>
            </>
          ) : null}

          {order.stage === 'lista_para_entregar' && order.deliveryCode ? (
            <div className="rounded-2xl bg-brand-navy-900 p-5 text-center text-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Código de entrega</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-signal-amber" data-testid="codigo-entrega">{order.deliveryCode}</p>
              <p className="mt-3 text-xs leading-relaxed text-white/75">
                Dáselo a {order.merchantName} solo cuando tengas el producto en la mano. Con ese código tu crédito queda vigente y la primera cuota vence en un mes.
              </p>
            </div>
          ) : null}

          {delivered ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">Retiraste tu compra. Tu crédito está vigente.</p>
              <Link href={`/dashboard/creditos/${order.loanId}`} className="text-sm font-semibold text-emerald-800 underline">
                Ver cuotas
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
