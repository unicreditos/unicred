'use client'

import { getMyWallet, payWithWallet, sendFromWallet } from '@/app/actions/wallet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatARS, formatARSDecimal } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { ArrowDownLeft, ArrowUpRight, Loader2, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type Wallet = Awaited<ReturnType<typeof getMyWallet>>

export function WalletDesk({
  pendingInstallments = [],
  onPaid,
}: {
  pendingInstallments?: { id: string; number: number; amount: number | string; loanId: string }[]
  onPaid?: () => void
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'ingresar' | 'transferir' | 'cuotas'>('ingresar')
  const [destination, setDestination] = useState('')
  const [outAmount, setOutAmount] = useState('')
  const [concept, setConcept] = useState('Transferencia')
  const [payId, setPayId] = useState(pendingInstallments[0]?.id ?? '')
  const [confirmingSend, setConfirmingSend] = useState(false)

  const refresh = useCallback(async () => {
    const next = await getMyWallet()
    setWallet(next)
    return next
  }, [])

  useEffect(() => {
    // Trae el saldo apenas monta el panel; no hay valor derivable del estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch((err) => toast.error((err as Error).message))
  }, [refresh])

  if (!payId && pendingInstallments[0]) setPayId(pendingInstallments[0].id)

  async function send() {
    setBusy(true)
    try {
      const next = await sendFromWallet(Number(outAmount.replace(',', '.')) || 0, destination, concept)
      setWallet(next)
      setDestination('')
      setOutAmount('')
      setConfirmingSend(false)
      toast.success(
        next.movements[0]?.kind === 'p2p_out'
          ? 'Transferencia interna acreditada al instante.'
          : 'Orden creada: saldo debitado. Tesorería RM ejecuta el egreso al destino.',
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function paySelected() {
    if (!payId) {
      toast.error('Elegí una cuota.')
      return
    }
    setBusy(true)
    try {
      const result = await payWithWallet([payId])
      toast.success(`Cuota pagada con la billetera. Recibo emitido (${formatARS(result.amount)}).`)
      await refresh()
      onPaid?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!wallet) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo tu billetera…
      </div>
    )
  }

  const selected = pendingInstallments.find((row) => row.id === payId)
  const selectedAmount = selected ? Number(selected.amount) || 0 : 0
  const canPay = Boolean(selected) && wallet.balance + 0.009 >= selectedAmount

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-brand-navy/10 bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-primary-900 text-white shadow-lg shadow-brand-navy/20">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-cian-200">
              <WalletCards className="h-4 w-4" /> Billetera UNICRÉDITOS
            </p>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
              {formatARSDecimal(wallet.balance)}
            </p>
            <p className="mt-1.5 text-sm text-white/70">Saldo disponible · ARS</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-card/10 px-3 py-2 text-xs backdrop-blur">
            <p className="text-white/60">Estado</p>
            <p className="font-semibold capitalize text-white">{wallet.status === 'active' ? 'Activa' : wallet.status}</p>
          </div>
        </div>
        <div className="grid gap-px bg-card/10 sm:grid-cols-1">
          <div className="bg-black/25 px-5 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Ledger interno</p>
            <p className="mt-1 text-sm text-white/85">
              Saldo de cuenta propia UNICRÉDITOS. No es un CVU Coelsa ni un alias de un PSP. El
              préstamo se acredita en el CBU/CVU bancario de Cuentas de desembolso.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2">
          {([
            ['ingresar', 'Ingresar'],
            ['transferir', 'Transferir'],
            ['cuotas', 'Pagar cuota'],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={panel === id ? 'default' : 'outline'}
              onClick={() => setPanel(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {panel === 'ingresar' ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              El saldo de esta billetera es un ledger interno. No publiques ni copies un CVU: UNICRÉDITOS no
              emite CVU Coelsa. Para recibir el préstamo usá Cuentas de desembolso (CBU/CVU bancario a tu nombre).
            </p>
            <div className="rounded-xl border bg-muted p-3 text-sm text-slate-700">
              Referencia interna de tesorería: {wallet.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        ) : null}

        {panel === 'transferir' ? (
          confirmingSend ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Confirmá el envío</p>
                <p className="mt-2">
                  <span className="font-bold">{formatARS(Number(outAmount.replace(',', '.')) || 0)}</span> a{' '}
                  <span className="font-mono">{destination}</span>
                </p>
                <p className="mt-0.5 text-xs text-amber-800">Concepto: {concept || '—'}</p>
                <p className="mt-2 text-xs text-amber-800">
                  Una vez confirmado, se debita al instante y no se puede deshacer desde acá.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setConfirmingSend(false)}
                >
                  Cancelar
                </Button>
                <Button type="button" className="flex-1 font-semibold" disabled={busy} onClick={() => void send()}>
                  {busy ? 'Enviando…' : 'Confirmar envío'}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setConfirmingSend(true)
              }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Destino UNICRÉDITOS: acreditación inmediata. Destino bancario externo: debitamos tu saldo y tesorería
                RM ({wallet.treasuryOrigin}) ejecuta la transferencia.
              </p>
              <div className="space-y-1">
                <Label htmlFor="wallet-dest">Destino</Label>
                <Input
                  id="wallet-dest"
                  placeholder="CBU, CVU o alias"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="wallet-out-amount">Importe</Label>
                  <Input
                    id="wallet-out-amount"
                    inputMode="decimal"
                    value={outAmount}
                    onChange={(e) => setOutAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wallet-concept">Concepto</Label>
                  <Input id="wallet-concept" value={concept} onChange={(e) => setConcept(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="font-semibold">
                Revisar y transferir
              </Button>
            </form>
          )
        ) : null}

        {panel === 'cuotas' ? (
          <div className="mt-4 space-y-3">
            {pendingInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenés cuotas pendientes para pagar con saldo.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="wallet-pay-id">Cuota</Label>
                  <select
                    id="wallet-pay-id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={payId}
                    onChange={(e) => setPayId(e.target.value)}
                  >
                    {pendingInstallments.map((row) => (
                      <option key={row.id} value={row.id}>
                        Cuota #{row.number} · {formatARS(Number(row.amount) || 0)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  className="w-full font-semibold"
                  disabled={busy || !canPay}
                  onClick={() => void paySelected()}
                >
                  {busy
                    ? 'Pagando…'
                    : canPay
                      ? `Pagar ${formatARS(selectedAmount)} con billetera`
                      : 'Saldo insuficiente'}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold text-brand-navy">Movimientos</p>
        {wallet.movements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay movimientos en esta billetera.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {wallet.movements.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      row.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-slate-600',
                    )}
                  >
                    {row.direction === 'in' ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">
                      {row.kind === 'sandbox_load'
                        ? 'Carga (desarrollo)'
                        : row.kind === 'p2p_in' || row.kind === 'p2p_out'
                          ? 'Transferencia interna'
                          : row.kind === 'service_bill' || row.kind === 'service_recharge'
                            ? 'Pago de servicio'
                            : row.kind === 'installment' || row.kind === 'pay_installment'
                              ? 'Pago de cuota'
                              : row.notes || row.kind}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.reference || '—'} · {new Date(row.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    'shrink-0 font-bold tabular-nums',
                    row.direction === 'in' ? 'text-emerald-700' : 'text-brand-navy',
                  )}
                >
                  {row.direction === 'in' ? '+' : '−'}
                  {formatARS(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {wallet.payouts.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <p className="text-sm font-bold text-brand-navy">Egresos a bancos</p>
          <ul className="mt-3 divide-y divide-border/60">
            {wallet.payouts.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold">{row.destinationValue}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status} · {row.rail} · {row.reference}
                  </p>
                </div>
                <p className="font-bold tabular-nums">{formatARS(row.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function WalletPayBox({
  installmentIds,
  amount,
  onSettled,
}: {
  installmentIds: string[]
  amount: number
  onSettled?: () => void
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getMyWallet()
      .then(setWallet)
      .catch((err) => toast.error((err as Error).message))
  }, [])

  async function pay() {
    setBusy(true)
    try {
      await payWithWallet(installmentIds)
      toast.success('Pago acreditado con la billetera. El recibo quedó en tu panel.')
      onSettled?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!wallet) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo billetera…
      </p>
    )
  }

  const enough = wallet.balance + 0.009 >= amount

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 py-2 text-xs text-brand-navy">
        Billetera UNICRÉDITOS. Los egresos externos salen desde la cuenta de tesorería RM.
      </p>
      <div className="rounded-lg border bg-muted p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo</p>
        <p className="text-xl font-semibold tabular-nums">{formatARSDecimal(wallet.balance)}</p>
        <p className="mt-2 text-xs text-slate-600">Ledger interno · no es CVU Coelsa.</p>
      </div>
      {enough ? (
        <Button type="button" className="w-full font-semibold" disabled={busy} onClick={() => void pay()}>
          {busy ? 'Debitando…' : `Pagar ${formatARS(amount)} con la billetera`}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            Faltan {formatARS(Math.max(0, amount - wallet.balance))} para cubrir esta cuota.
          </p>
          <p className="text-xs text-muted-foreground">
            Transferí al CVU o alias de tu billetera. Cuando Payway confirme el ingreso, el saldo aparece acá.
          </p>
        </div>
      )}
    </div>
  )
}
