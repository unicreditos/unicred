'use client'

import { createPaymentLink, getCheckoutStatus, getCollectionAccount, reportBankTransfer, type PaymentMethod } from '@/app/actions/payments'
import { MercadoPagoCheckoutBrick, type BrickChannel } from '@/components/payments/mp-checkout-brick'
import { WalletPayBox } from '@/components/payments/wallet-desk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type InstallmentPay = {
  id: string
  number: number
  amount: number | string
  dueDate: Date | string
  loanId: string
}

const CUSTOMER_METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'tarjeta_credito', label: 'Tarjeta de crédito', hint: 'Formulario en este punto de venta. No hace falta entrar a Mercado Pago.' },
  { id: 'tarjeta_debito', label: 'Tarjeta de débito', hint: 'Formulario en este punto de venta. No hace falta entrar a Mercado Pago.' },
  { id: 'pago_facil', label: 'Pago Fácil', hint: 'Se emite el cupón ahora. Tiene vencimiento: pagalo o imprimilo en el momento.' },
  { id: 'rapipago', label: 'Rapipago', hint: 'Se emite el cupón ahora. Tiene vencimiento: pagalo o imprimilo en el momento.' },
  { id: 'payway_wallet', label: 'Billetera UNICRÉDITOS', hint: 'Saldo y CVU de tu cuenta. El cobro queda en esta plataforma.' },
  { id: 'transferencia_bancaria', label: 'Transferencia a RM', hint: 'Transferí al CBU de tesorería y subí el comprobante.' },
]

function isConcreteMethod(method: PaymentMethod | undefined): method is PaymentMethod {
  return CUSTOMER_METHODS.some((row) => row.id === method)
}

function isCardMethod(method: PaymentMethod) {
  return method === 'tarjeta_credito' || method === 'tarjeta_debito'
}

function isTicketMethod(method: PaymentMethod) {
  return method === 'pago_facil' || method === 'rapipago' || method === 'ticket'
}

function needsMpSession(method: PaymentMethod) {
  return isCardMethod(method) || isTicketMethod(method)
}

function toBrickChannel(method: PaymentMethod): BrickChannel {
  if (method === 'pago_facil') return 'pago_facil'
  if (method === 'rapipago') return 'rapipago'
  if (method === 'ticket' || method === 'efectivo') return 'ticket'
  if (method === 'tarjeta_credito') return 'credit_card'
  if (method === 'tarjeta_debito') return 'debit_card'
  return 'credit_card'
}

function payCta(method: PaymentMethod) {
  if (method === 'tarjeta_credito') return 'Pagar con tarjeta de crédito'
  if (method === 'tarjeta_debito') return 'Pagar con tarjeta de débito'
  if (method === 'pago_facil') return 'Emitir cupón Pago Fácil'
  if (method === 'rapipago') return 'Emitir cupón Rapipago'
  if (method === 'ticket') return 'Emitir cupón de efectivo'
  if (method === 'transferencia_bancaria') return 'Informar transferencia'
  if (method === 'payway_wallet') return 'Pagar con billetera UNICRÉDITOS'
  return 'Pagar'
}

export function PayInstallmentDialog({
  open,
  onClose,
  installments,
  email,
  method,
  returnPath,
  onSettled,
}: {
  open: boolean
  onClose: () => void
  installments: InstallmentPay[]
  email?: string | null
  method?: PaymentMethod
  returnPath?: string
  onSettled?: () => void
}) {
  const [chosen, setChosen] = useState<PaymentMethod | null>(isConcreteMethod(method) ? method : null)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<{
    paymentId: string
    preferenceId: string
    publicKey: string | null
    amount: number
    paymentLinkUrl: string
    coupon: string | null
    qrData: string | null
    mpCustomerId: string | null
    mpCardIds: string[]
    gateway: string | null
  } | null>(null)
  const [treasury, setTreasury] = useState<Awaited<ReturnType<typeof getCollectionAccount>> | null>(null)
  const startedFor = useRef('')
  const idsKey = installments.map((row) => row.id).join(',')

  const total = installments.reduce((sum, row) => sum + Number(row.amount), 0)

  const startMp = useCallback(
    async (channel: PaymentMethod) => {
      setBusy(true)
      try {
        const r = await createPaymentLink(
          installments.map((row) => row.id),
          channel,
          returnPath ? { returnPath } : undefined,
        )
        if (!r.publicKey || !r.externalPreferenceId) {
          throw new Error('Falta la clave pública o la preferencia de cobro.')
        }
        setSession({
          paymentId: r.paymentId,
          preferenceId: r.externalPreferenceId ?? r.paymentId,
          publicKey: r.publicKey ?? null,
          amount: r.amount,
          paymentLinkUrl: r.paymentLinkUrl ?? '',
          coupon: r.coupon,
          qrData: r.qrData ?? null,
          mpCustomerId: r.mpCustomerId ?? null,
          mpCardIds: r.mpCardIds ?? [],
          gateway: r.gateway ?? 'mercado_pago',
        })
      } catch (err) {
        toast.error((err as Error).message)
        startedFor.current = ''
      } finally {
        setBusy(false)
      }
    },
    [installments, returnPath],
  )

  useEffect(() => {
    if (!open) {
      startedFor.current = ''
      setSession(null)
      setChosen(isConcreteMethod(method) ? method : null)
      return
    }
    setChosen(isConcreteMethod(method) ? method : null)
    void getCollectionAccount().then(setTreasury).catch(() => setTreasury(null))
  }, [open, method, idsKey])

  useEffect(() => {
    if (!open || !chosen || !needsMpSession(chosen)) return
    const key = `${idsKey}:${chosen}`
    if (startedFor.current === key) return
    startedFor.current = key
    void startMp(chosen)
  }, [open, chosen, idsKey, startMp])

  const handlePaid = useCallback(
    async (status: string, extra?: { receiptId?: string | null; credited?: number }) => {
      if (status === 'approved' && extra?.credited && extra.credited > 0) {
        toast.success('Pago acreditado. Ya podés descargar el recibo.')
        onSettled?.()
        onClose()
        return
      }
      if (status === 'approved' && session?.paymentId) {
        toast.message('Confirmando el cobro…')
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
        toast.message('El cobro fue aceptado. El recibo aparece cuando se confirma el dinero.')
        onClose()
        return
      }
      if (status === 'rejected') {
        toast.error('No se pudo cobrar. Probá otra tarjeta u otro medio.')
        return
      }
      toast.message(
        isTicketMethod(chosen ?? 'ticket')
          ? 'Cupón emitido. Pagalo en la red antes del vencimiento. El recibo se emite al acreditar.'
          : `Estado del cobro: ${status}.`,
      )
    },
    [chosen, onClose, onSettled, session?.paymentId],
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

  const title =
    installments.length === 1
      ? `Cuota ${String(installments[0].number).padStart(2, '0')} · ${formatARS(total)}`
      : `${installments.length} cuotas · ${formatARS(total)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-brand-navy-900">Punto de venta UNICRÉDITOS</h2>
            <p className="text-xs text-slate-500">{title}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        {!chosen ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-slate-600">
              Elegí el medio. El pago se hace desde tu cuenta UNICRÉDITOS. Si es tarjeta, se abre el formulario acá
              mismo. Si es Pago Fácil o Rapipago, el cupón se emite ahora porque vence.
            </p>
            <div className="grid gap-2">
              {CUSTOMER_METHODS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-brand-primary/40 hover:bg-slate-50"
                  onClick={() => {
                    setSession(null)
                    startedFor.current = ''
                    setChosen(row.id)
                  }}
                >
                  <p className="text-sm font-semibold text-brand-navy-900">{row.label}</p>
                  <p className="text-[11px] text-slate-500">{row.hint}</p>
                </button>
              ))}
            </div>
          </div>
        ) : chosen === 'payway_wallet' ? (
          <div className="p-4">
            <WalletPayBox
              installmentIds={installments.map((row) => row.id)}
              amount={total}
              onSettled={() => {
                onSettled?.()
                onClose()
              }}
            />
          </div>
        ) : chosen === 'transferencia_bancaria' ? (
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
                  <dd>
                    {treasury?.bank} · {treasury?.accountType}
                  </dd>
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
                Transferí {formatARS(total)}. En el concepto usá el ID del crédito y el n° de cuota. La cuota no se
                marca paga hasta que tesorería vea el dinero en Brubank.
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
        ) : (
          <div className="space-y-4 p-4">
            <p className="text-xs font-medium text-slate-600">
              {isCardMethod(chosen)
                ? 'Cargá los datos de la tarjeta como en un punto de venta. El cobro es de UNICRÉDITOS: no tenés que entrar a tu cuenta de Mercado Pago.'
                : 'Se emite solo el cupón de este medio. Tiene fecha de vencimiento: imprimilo o pagalo ahora.'}
            </p>
            {session?.publicKey ? (
              <MercadoPagoCheckoutBrick
                publicKey={session.publicKey}
                amount={session.amount}
                email={email}
                localPaymentId={session.paymentId}
                channel={toBrickChannel(chosen)}
                customerId={session.mpCustomerId}
                cardIds={session.mpCardIds}
                onPaid={handlePaid}
                onError={handleBrickError}
              />
            ) : (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void startMp(chosen)}>
                {busy ? 'Abriendo…' : payCta(chosen)}
              </Button>
            )}
            <button
              type="button"
              className="text-xs text-slate-500 underline"
              onClick={() => {
                setChosen(null)
                setSession(null)
                startedFor.current = ''
              }}
            >
              Elegir otro medio
            </button>
          </div>
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

export { payCta, isConcreteMethod, CUSTOMER_METHODS }
