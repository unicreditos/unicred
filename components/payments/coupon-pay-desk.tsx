'use client'

import {
  createCouponCheckout,
  reportCouponTransfer,
  type PaymentMethod,
} from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { barcodeSvg } from '@/lib/coupon'
import { installmentPosPath } from '@/lib/workspace-gate'
import { formatARS, formatARSDecimal } from '@/lib/finance'
import { isMercadoPagoEmvQr } from '@/lib/payments/mp-qr-payload'
import type { TreasuryClientView } from '@/lib/treasury'
import QRCode from 'qrcode'
import { Landmark, Loader2, QrCode, Smartphone, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type Treasury = TreasuryClientView

const CHANNELS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'mercado_pago', label: 'Mercado Pago · todos los medios', hint: 'Tarjeta, dinero en cuenta, QR, Pago Fácil y Rapipago' },
  { id: 'pago_facil', label: 'Pago Fácil', hint: 'Cupón para pagar en efectivo en la red' },
  { id: 'rapipago', label: 'Rapipago', hint: 'Cupón para pagar en efectivo en la red' },
  { id: 'tarjeta_credito', label: 'Tarjeta de crédito', hint: 'Formulario en tu panel, como una caja' },
  { id: 'tarjeta_debito', label: 'Tarjeta de débito', hint: 'Formulario en tu panel, como una caja' },
  { id: 'mercadopago_wallet', label: 'Dinero en cuenta', hint: 'Saldo Mercado Pago' },
]

export function CouponPayDesk({
  installment,
  mpStatus,
  guest = false,
}: {
  installment: {
    id: string
    number: number
    amount: string | number
    dueDate: Date | string
    dueLabel?: string
    status: string
    paidAt: Date | string | null
    paidLabel?: string | null
    loanId: string
    loanStatus: string | null
    coupon: string
    treasury: Treasury
  }
  mpStatus?: string
  guest?: boolean
}) {
  const [method, setMethod] = useState<PaymentMethod>('mercado_pago')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [mpQr, setMpQr] = useState<string | null>(null)
  const [amount, setAmount] = useState(Number(installment.amount) || 0)
  const barcode = useMemo(() => barcodeSvg(installment.coupon, { height: 42, module: 1.2 }), [installment.coupon])
  const due = installment.dueLabel ?? ''

  const start = useCallback(async (channel: PaymentMethod, redirect = false) => {
    setBusy(true)
    try {
      const r = await createCouponCheckout(installment.id, channel)
      setLink(r.paymentLinkUrl)
      setAmount(r.amount)
      if (isMercadoPagoEmvQr(r.qrData)) {
        const data = await QRCode.toDataURL(r.qrData, { margin: 1, width: 280 })
        setMpQr(data)
        if (redirect && r.paymentLinkUrl) {
          window.location.href = r.paymentLinkUrl
          return
        }
      } else {
        setMpQr(null)
        throw new Error('Mercado Pago no emitió un QR de pago válido para esta cuota.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir Mercado Pago.')
    } finally {
      setBusy(false)
    }
  }, [installment.id])

  useEffect(() => {
    void start('mercado_pago', false)
  }, [start])

  if (installment.status === 'paid' || installment.status === 'cancelled') {
    return (
      <div className="rounded-xl border bg-white p-6 text-center">
        <p className="text-lg font-semibold">Esta cuota ya no está abierta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {installment.paidAt
            ? `Pagada el ${installment.paidLabel ?? 'fecha registrada'}.`
            : 'El talón fue anulado.'}
        </p>
      </div>
    )
  }

  async function sendTransfer(formData: FormData) {
    setBusy(true)
    try {
      formData.set('amount', String(installment.amount))
      await reportCouponTransfer(installment.id, formData)
      toast.success('Comprobante enviado. Tesorería acredita cuando vea el dinero en Brubank.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo informar la transferencia.')
    } finally {
      setBusy(false)
    }
  }

  const treasury = installment.treasury
  const mpBanner =
    mpStatus === 'success'
      ? 'Mercado Pago aceptó el cobro. El recibo aparece cuando confirma el dinero.'
      : mpStatus === 'pending'
        ? 'Pago pendiente. Si elegiste Pago Fácil o Rapipago, completá el cupón en la red.'
        : mpStatus === 'failure'
          ? 'Mercado Pago no pudo cobrar. Probá otro medio o transferí a Brubank.'
          : null

  return (
    <div className="space-y-4">
      {mpBanner ? (
        <p className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-700">{mpBanner}</p>
      ) : null}
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="space-y-4 rounded-xl border bg-white p-5 lg:col-span-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cuota a pagar</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatARS(installment.amount)}</p>
          <p className="text-sm text-muted-foreground">
            Cuota {String(installment.number).padStart(2, '0')} · vence {due}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setMethod(c.id)
                if (guest && (c.id === 'tarjeta_credito' || c.id === 'tarjeta_debito')) return
                void start(c.id, false)
              }}
              className={`rounded-lg border p-3 text-left text-sm ${
                method === c.id ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-200'
              }`}
            >
              <span className="font-semibold">{c.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{c.hint}</span>
            </button>
          ))}
        </div>

        {guest && (method === 'tarjeta_credito' || method === 'tarjeta_debito') ? (
          <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3">
            <p className="text-sm font-medium text-brand-navy-900">Pagar con tarjeta en la caja</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ingresá a tu cuenta para cargar una tarjeta nueva o usar una guardada. El cobro queda en el panel; no
              volvés al sitio público.
            </p>
            <Button asChild className="mt-3 w-full">
              <a href={`/sign-in?next=${encodeURIComponent(installmentPosPath(installment.id, method))}`}>
                Ingresar y pagar con {method === 'tarjeta_debito' ? 'débito' : 'crédito'}
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !link} onClick={() => link && (window.location.href = link)} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Pagar en la web Mercado Pago
            </Button>
            <Button
              variant="outline"
              disabled={busy || !link}
              onClick={() => link && (window.location.href = link)}
              className="gap-1.5"
            >
              <Smartphone className="h-4 w-4" />
              Abrir en la app
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          El QR de la derecha es el código EMV de Mercado Pago con el importe de esta cuota
          ({formatARS(amount)}). Escanealo con la app. En la web podés elegir tarjeta, dinero en
          cuenta, Pago Fácil o Rapipago. El recibo se emite cuando el cobro está confirmado.
        </p>
      </section>

      <aside className="space-y-4 lg:col-span-5">
        <div className="rounded-xl border bg-white p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode className="h-4 w-4" /> QR Mercado Pago
          </p>
          {mpQr ? (
            <div className="mt-3 flex flex-col items-center">
              <img src={mpQr} alt="QR de checkout Mercado Pago" className="h-48 w-48" />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Escaneá con la app Mercado Pago. Importe {formatARSDecimal(amount)}.
              </p>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generando checkout…
            </p>
          )}
          <div className="mt-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: barcode }} />
        </div>

        <form action={sendTransfer} className="space-y-3 rounded-xl border bg-white p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Landmark className="h-4 w-4" /> Transferencia a RM
          </p>
          <dl className="grid gap-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Titular</dt>
              <dd className="font-medium">{treasury.holder}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">CUIT</dt>
              <dd className="font-mono">{treasury.cuit}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Banco</dt>
              <dd>{treasury.bank}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">CBU</dt>
              <dd className="font-mono">{treasury.cbu}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">N° cuenta</dt>
              <dd className="font-mono">{treasury.accountNumber}</dd>
            </div>
            {treasury.alias ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Alias</dt>
                <dd className="font-mono">{treasury.alias}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-[11px] text-muted-foreground">
            Transferí {formatARS(installment.amount)} y poné en el concepto {installment.coupon}. Tesorería acredita
            cuando ve el dinero en Brubank.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="transferDate">Fecha</Label>
              <Input id="transferDate" name="transferDate" type="date" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reference">N° de operación</Label>
              <Input id="reference" name="reference" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="proof">Comprobante</Label>
            <Input id="proof" name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
          </div>
          <Button type="submit" variant="outline" disabled={busy} className="w-full">
            Informar transferencia
          </Button>
        </form>
      </aside>
    </div>
    </div>
  )
}
