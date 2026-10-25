'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { adminApprovePayout, adminRejectPayout } from '@/app/actions/admin-wallet'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Resolver un retiro pendiente: aprobar (la transferencia ya se envió, con su referencia) o rechazar con motivo. */
export function PayoutActions({ payoutId, label }: { payoutId: string; label: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = mode === 'approve' ? await adminApprovePayout({ payoutId, bankReference: text }) : await adminRejectPayout({ payoutId, reason: text })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(mode === 'approve' ? 'Retiro aprobado y notificado' : 'Retiro rechazado: el dinero volvió a la billetera')
      setMode('idle')
      setText('')
      router.refresh()
    })
  }

  if (mode === 'idle') {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMode('approve')} aria-label={`Aprobar el retiro ${label}`}>
          Aprobar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode('reject')} aria-label={`Rechazar el retiro ${label}`}>
          Rechazar
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:w-96">
      <label className="text-[13px] font-medium" htmlFor={`t-${payoutId}`}>
        {mode === 'approve' ? 'Referencia de la transferencia enviada' : 'Motivo del rechazo (lo ve la persona)'}
      </label>
      <Input
        id={`t-${payoutId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        minLength={mode === 'approve' ? 4 : 10}
        placeholder={mode === 'approve' ? 'N° de operación o comprobante del banco' : 'Ej. Los datos de la cuenta no coinciden'}
        autoFocus
      />
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending} variant={mode === 'reject' ? 'destructive' : 'default'}>
          {pending ? 'Guardando…' : mode === 'approve' ? 'Confirmar envío' : 'Confirmar rechazo'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode('idle')}>
          Volver
        </Button>
      </div>
    </form>
  )
}
