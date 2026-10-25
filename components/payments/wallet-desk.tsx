'use client'

import { getMyWallet, payWithWallet } from '@/app/actions/wallet'
import { Button } from '@/components/ui/button'
import { formatARS, formatARSDecimal } from '@/lib/finance'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Wallet = Awaited<ReturnType<typeof getMyWallet>>

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
            Transferí al CVU o alias de tu billetera. Cuando tesorería confirme el ingreso, el saldo aparece acá.
          </p>
        </div>
      )}
    </div>
  )
}
