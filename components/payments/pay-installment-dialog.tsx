'use client'

import { createPaymentLink, getCheckoutStatus, getCollectionAccount, reportBankTransfer, type PaymentMethod } from '@/app/actions/payments'
import { MercadoPagoCheckoutBrick, type BrickChannel } from '@/components/payments/mp-checkout-brick'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { barcodeSvg, couponCode } from '@/lib/coupon'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'
import QRCode from 'qrcode'
import { Landmark, QrCode, Wallet, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type InstallmentPay = {
  id: string
  number: number
  amount: number | string
  dueDate: Date | string
  loanId: string
}

type Tab = 'mp' | 'transfer'

function toBrickChannel(method: PaymentMethod): BrickChannel {
  if (method === 'pago_facil') return 'pago_facil'
  if (method === 'rapipago') return 'rapipago'
  if (method === 'ticket' || method === 'efectivo') return 'ticket'
  if (method === 'tarjeta_credito') return 'credit_card'
  if (method === 'tarjeta_debito') return 'debit_card'
  if (method === 'mercadopago_wallet' || method === 'cvu') return 'account_money'
  return 'all'
}

export function PayInstallmentDialog({
  open,
  onClose,
  installments,
  email,
  initialTab = 'mp',
  method = 'mercado_pago',
  payPathPrefix = '/dashboard/pagar',
  returnPath,
  onSettled,
}: {
  open: boolean
  onClose: () => void
  installments: InstallmentPay[]
  email?: string | null
  initialTab?: Tab
  method?: PaymentMethod
  payPathPrefix?: string
  returnPath?: string
  onSettled?: () => void
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
  const startedFor = useRef('')
  const idsKey = installments.map((row) => row.id).join(',')

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

  const startMp = useCallback(async () => {
    setBusy(true)
    try {
      const r = await createPaymentLink(
        installments.map((row) => row.id),
        method,
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
  }, [installments, method, returnPath])

  useEffect(() => {
    if (!open) {
      startedFor.current = ''
      return
    }
    setTab(initialTab)
    void getCollectionAccount().then(setTreasury).catch(() => setTreasury(null))
    if (initialTab !== 'mp') return
    const key = `${idsKey}:${method}`
    if (startedFor.current === key) return
    startedFor.current = key
    void startMp()
  }, [open, idsKey, initialTab, method, startMp])

  useEffect(() => {
    const url = session?.paymentLinkUrl || fallbackPayUrl
    if (!url) return
    void QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr)
  }, [session?.paymentLinkUrl, fallbackPayUrl])

  const handlePaid = useCallback(
    async (status: string, extra?: { receiptId?: string | null; credited?: number }) => {
      if (status === 'approved' && extra?.credited && extra.credited > 0) {
        toast.success('Pago acreditado. Ya podés descargar el recibo.')
        onSettled?.()
        onClose()
        return
      }
      if (status === 'approved' && session?.paymentId) {
        toast.message('Confirmando el cobro con Mercado Pago…')
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 2500))
          try {
            const st = await getCheckoutStatus(session.paymentId)
            if (st.settled) {
              toast.success('Pago acreditado. El recibo quedó en tu panel.')
              onSettled?.()
              onClose()
              return
            }
          } catch {
            /* reintento */
          }
        }
        toast.message('El cobro fue aceptado. El recibo aparece cuando Mercado Pago confirma el dinero.')
        onClose()
        return
      }
      if (status === 'rejected') {
        toast.error('Mercado Pago no pudo cobrar. Probá otro medio.')
        return
      }
      toast.message(`Mercado Pago: ${status}. Si es cupón, pagalo en la red y el recibo se emite al acreditar.`)
    },
    [onClose, onSettled, session?.paymentId],
  )

  const handleBrickError = useCallback((message: string) => {
    toast.error(message)
  }, [])

  if (!open) return null

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
          <Button
            type="button"
            size="sm"
            variant={tab === 'mp' ? 'default' : 'outline'}
            onClick={() => {
              setTab('mp')
              if (!session) void startMp()
            }}
          >
            <Wallet className="h-3.5 w-3.5" /> Mercado Pago
          </Button>
          <Button type="button" size="sm" variant={tab === 'transfer' ? 'default' : 'outline'} onClick={() => setTab('transfer')}>
            <Landmark className="h-3.5 w-3.5" /> Transferencia RM
          </Button>
        </div>

        {tab === 'mp' ? (
          <div className="space-y-4 p-4">
            {session ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Pagá con tarjeta, dinero en cuenta, Pago Fácil o Rapipago. El recibo se emite cuando Mercado Pago confirma el dinero.
                </p>
                <MercadoPagoCheckoutBrick
                  publicKey={session.publicKey}
                  amount={session.amount}
                  email={email}
                  localPaymentId={session.paymentId}
                  channel={toBrickChannel(method)}
                  onPaid={handlePaid}
                  onError={handleBrickError}
                />
              </div>
            ) : (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void startMp()}>
                {busy ? 'Abriendo Mercado Pago…' : 'Reintentar cobro Mercado Pago'}
              </Button>
            )}

            <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                Pagar con QR o talón desde la app
              </summary>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {qr ? (
                  <div className="flex flex-col items-center">
                    <img src={qr} alt="QR de pago Mercado Pago" className="h-36 w-36" />
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
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Talón de la cuota</p>
                    <div dangerouslySetInnerHTML={{ __html: barcode }} />
                    <p className="mt-1 font-mono text-[11px] text-slate-600">{coupon}</p>
                  </div>
                ) : null}
              </div>
            </details>
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
                La cuota no se marca paga hasta que tesorería vea el dinero en Brubank.
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
