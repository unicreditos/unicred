'use client'

import { withdrawLoanAcceptancePublic } from '@/app/actions/withdrawal-public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export function PublicWithdrawalForm() {
  const [cuil, setCuil] = useState('')
  const [email, setEmail] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await withdrawLoanAcceptancePublic({ cuil, email, reference })
      setOk(result.ok)
      setMessage(result.ok ? 'Arrepentimiento registrado. El contrato y el cronograma quedaron anulados.' : result.error)
    } catch (err) {
      setOk(false)
      setMessage(err instanceof Error ? err.message : 'No se pudo registrar el arrepentimiento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="wd-cuil">CUIL</Label>
        <Input id="wd-cuil" value={cuil} onChange={(e) => setCuil(e.target.value)} inputMode="numeric" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wd-email">Email de la cuenta</Label>
        <Input id="wd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wd-ref">ID del crédito o del contrato</Label>
        <Input id="wd-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="loan_… o CTR-…" required />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Ejercer arrepentimiento'}
      </Button>
      {message ? (
        <p className={ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>{message}</p>
      ) : null}
    </form>
  )
}
