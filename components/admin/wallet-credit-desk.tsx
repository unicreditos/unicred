'use client'

import { adminCreditWallet, lookupWalletForCredit } from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmDialog } from '@/components/admin/confirm-dialog'
import { formatARS } from '@/lib/finance'
import { useState } from 'react'
import { toast } from 'sonner'

type Match = Awaited<ReturnType<typeof lookupWalletForCredit>>

export function WalletCreditDesk() {
  const [destination, setDestination] = useState('')
  const [match, setMatch] = useState<Match>(null)
  const [searching, setSearching] = useState(false)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirm, confirmDialog } = useConfirmDialog()

  async function search() {
    if (!destination.trim()) return
    setSearching(true)
    setMatch(null)
    try {
      const found = await lookupWalletForCredit(destination.trim())
      if (!found) toast.error('No se encontró una billetera con ese CVU/alias.')
      setMatch(found)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  function requestCredit() {
    if (!match) return
    const amountNum = Number(amount)
    confirm(
      {
        title: 'Acreditar billetera',
        description: `Vas a acreditar ${formatARS(amountNum)} a ${match.name ?? match.email ?? match.cvu} contra la referencia "${reference.trim()}". Esta acción no se puede deshacer.`,
        confirmLabel: 'Acreditar',
      },
      () => void credit(amountNum),
    )
  }

  async function credit(amountNum: number) {
    if (!match) return
    setBusy(true)
    try {
      const res = await adminCreditWallet(destination.trim(), amountNum, reference, notes)
      toast.success(`Billetera acreditada · nuevo saldo ${formatARS(res.balance)}`)
      setMatch({ ...match, balance: res.balance })
      setAmount('')
      setReference('')
      setNotes('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-[11px] text-muted-foreground">
        Acreditá a mano una transferencia que ya confirmaste en el extracto real de tesorería. No hay conciliación automática: buscá la billetera por CVU o alias, verificá el titular y cargá el monto.
      </p>
      <div className="flex gap-1.5">
        <Input
          placeholder="CVU o alias del cliente"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="h-8 text-[12px]"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={searching} onClick={() => void search()}>
          Buscar
        </Button>
      </div>
      {match ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px]">
          <p className="font-medium text-foreground">{match.name ?? 'Sin nombre'}</p>
          <p className="text-muted-foreground">{match.email}</p>
          <p className="mt-1 font-mono text-muted-foreground">
            {match.cvu} · @{match.alias}
          </p>
          <p className="mt-1">Saldo actual: <span className="font-mono font-semibold">{formatARS(match.balance)}</span></p>
          <div className="mt-2 space-y-1.5">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Monto a acreditar"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-[12px]"
            />
            <Input
              placeholder="Referencia del extracto (obligatoria)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-8 text-[12px]"
            />
            <Input
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-[12px]"
            />
            <Button
              size="sm"
              className="h-8 w-full"
              disabled={busy || !amount || !reference.trim()}
              onClick={requestCredit}
            >
              Acreditar
            </Button>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  )
}
