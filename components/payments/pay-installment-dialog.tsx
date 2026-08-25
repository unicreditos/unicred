'use client'

import { createPaymentLink, getCollectionAccount, reportBankTransfer } from '@/app/actions/payments'
import { MercadoPagoCheckoutBrick } from '@/components/payments/mp-checkout-brick'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { barcodeSvg, couponCode } from '@/lib/coupon'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'
import QRCode from 'qrcode'
import { Landmark, QrCode, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type InstallmentPay = {
  id: string
  number: number
  amount: number | string
  dueDate: Date | string
  loanId: string
}

type Tab = 'mp' | 'transfer'

export function PayInstallmentDialog({
  open,
  onClose,
  installments,
  email,
  initialTab = 'mp',
  payPathPrefix = '/dashboard/pagar',
  returnPath,
}: {
  open: boolean
  onClose: () => void
  installments: InstallmentPay[]
  email?: string | null
  initialTab?: Tab
  /** Prefijo de URL para QR/fallback (sin barra final). Default: panel cliente. */
  payPathPrefix?: string
  /** Ruta de retorno post Mercado Pago (ej. /pedir/cuenta). */
  returnPath?: string
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<{
    paymentId: string
    preferenceId: string
    publicKey: string
    amount: number
    paymentLinkUrl: string
    coupon: string | null
  } | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [treasury, setTreasury] = useState<Awaited<ReturnType<typeof getCollectionAccount>> | null>(null)

  const total = installments.reduce((sum, row) => sum + Number(row.amount), 0)
  const single = installments.length === 1 ? installments[0] : null
  const coupon = useMemo(() => {
    if (!single) return session?.coupon ?? null
    return couponCode({
      loanId: single.loanId,
      number: single.number,
      dueDate: single.dueDate,
      amount: single.amount,
    })
  }, [single, session?.coupon])
  const barcode = coupon ? barcodeSvg(coupon) : null
  const fallbackPayUrl = useMemo(() => {
    if (!single) return null
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
    const path = `${payPathPrefix}/${single.id}`
    return origin ? `${origin}${path}` : path
  }, [single, payPathPrefix])

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setSession(null)
    setQr(null)
    void getCollectionAccount().then(setTreasury).catch(() => setTreasury(null))
    if (initialTab === 'mp') {
      void startMp()
    }
  }, [open, installments.map((row) => row.id).join(','), initialTab])

  useEffect(() => {
    const url = session?.paymentLinkUrl || fallbackPayUrl
    if (!url) return
    void QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr)
  }, [session?.paymentLinkUrl, fallbackPayUrl])

  if (!open) return null

  async function startMp() {
    setBusy(true)
    try {
      const r = await createPaymentLink(
        installments.map((row) => row.id),
        'mercado_pago',
        returnPath ? { returnPath } : undefined,
      )
      if (!r.publicKey || !r.externalPreferenceId) {
        throw new Error('Falta la public key o la preferencia de Mercado Pago.')
      }
      setSession({
        paymentId: r.paymentId,
        preferenceId: r.externalPreferenceId,
        publicKey: r.publicKey,
        amount: r.amount,
        paymentLinkUrl: r.paymentLinkUrl ?? '',
        coupon: r.coupon,
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendTransfer(formData: FormData) {
    setBusy(true)
    try {
      formData.set('amount', String(total))
      await reportBankTransfer(
        installments.map((row) => row.id),
        formData,
      )
      toast.success('Comprobante enviado. Tesorería lo acredita cuando vea el dinero en Brubank.')
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-brand-navy-900">Pagar en UNICRÉDITOS</h2>
            <p className="text-xs text-slate-500">
              {installments.length === 1
                ? `Cuota ${String(installments[0].number).padStart(2, '0')} · ${formatARS(total)}`
                : `${installments.length} cuotas · ${formatARS(total)}`}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
          <Button type="button" size="sm" variant={tab === 'mp' ? 'default' : 'outline'} onClick={() => setTab('mp')}>
            <Wallet className="h-3.5 w-3.5" /> Mercado Pago
          </Button>
          <Button type="button" size="sm" variant={tab === 'transfer' ? 'default' : 'outline'} onClick={() => setTab('transfer')}>
            <Landmark className="h-3.5 w-3.5" /> Transferencia RM
          </Button>
        </div>

        {tab === 'mp' ? (
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Talón de la cuota</p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {qr ? (
                  <div className="flex flex-col items-center">
                    <img src={qr} alt="QR de pago Mercado Pago" className="h-40 w-40" />
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      <QrCode className="h-3.5 w-3.5" /> QR Mercado Pago
                    </p>
                    <p className="max-w-[180px] text-center text-[10px] text-slate-500">
                      {formatARS(session?.amount ?? total)}. Escaneá desde Mercado Pago u otra billetera.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Generando QR…</p>
                )}
                {coupon && barcode ? (
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: barcode }} />
                    <p className="mt-1 font-mono text-[11px] text-slate-600">{coupon}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {session ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Pagar en el sitio con tarjeta o efectivo</p>
                <MercadoPagoCheckoutBrick
                  publicKey={session.publicKey}
                  amount={session.amount}
                  preferenceId={session.preferenceId}
                  email={email}
                  localPaymentId={session.paymentId}
                  onPaid={(status) => {
                    if (status === 'approved') {
                      toast.success('Pago aprobado. La cuota se acredita al confirmar Mercado Pago.')
                      onClose()
                    } else {
                      toast.message(`Mercado Pago: ${status}. Si es cupón, pagalo y esperá la acreditación.`)
                    }
                  }}
                  onError={(message) => toast.error(message)}
                />
              </div>
            ) : (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void startMp()}>
                {busy ? 'Abriendo Mercado Pago…' : 'Reintentar cobro Mercado Pago'}
              </Button>
            )}
          </div>
        ) : (
          <form action={sendTransfer} className="space-y-4 p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cuenta corriente RM</p>
              <dl className="mt-2 grid gap-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Titular</dt>
                  <dd className="font-medium">{treasury?.holder ?? 'RM International Group S.A.S.'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">CUIT</dt>
                  <dd className="font-mono">{treasury?.cuit}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Banco</dt>
                  <dd>{treasury?.bank} · {treasury?.accountType}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">CBU</dt>
                  <dd className="font-mono">{treasury?.cbu}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">N° cuenta</dt>
                  <dd className="font-mono">{treasury?.accountNumber}</dd>
                </div>
                {treasury?.alias ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Alias</dt>
                    <dd className="font-mono">{treasury.alias}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-2 text-[11px] text-slate-500">
                Transferí {formatARS(total)}. En el concepto usá {coupon ?? 'el ID del crédito y el n° de cuota'}.
                La cuota no se marca paga hasta que un admin verifique la acreditación en Brubank.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="transferDate">Fecha de transferencia</Label>
                <Input id="transferDate" name="transferDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">N° de operación</Label>
                <Input id="reference" name="reference" placeholder="Referencia del banco" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proof">Comprobante</Label>
              <Input id="proof" name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Informar transferencia
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export function PayInstallmentButton({
  installment,
  email,
  className,
}: {
  installment: InstallmentPay
  email?: string | null
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" size="sm" className={cn('h-8', className)} onClick={() => setOpen(true)}>
        Pagar
      </Button>
      <PayInstallmentDialog
        open={open}
        onClose={() => setOpen(false)}
        installments={[installment]}
        email={email}
      />
    </>
  )
}
