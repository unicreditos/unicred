'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { rollbackAction } from '@/app/admin/contenido/actions'

/** Restaurar una versión anterior: crea un borrador nuevo (no reescribe el historial). */
export function RestoreVersionButton({ itemKey, version, disabled }: { itemKey: string; version: number; disabled?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function go() {
    setPending(true)
    setError(null)
    const r = await rollbackAction(itemKey, version, reason)
    setPending(false)
    if (r.ok) {
      toast.success(r.message)
      setOpen(false)
      router.refresh()
    } else setError(r.error)
  }

  if (!open)
    return (
      <button type="button" className="uc-row-action" disabled={disabled} onClick={() => setOpen(true)} title={disabled ? 'Ya hay una versión en curso' : undefined}>
        Restaurar
      </button>
    )
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <input className="uc-field" style={{ width: 200 }} placeholder="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label={`Motivo para restaurar la versión ${version}`} />
      <button type="button" className="uc-row-action" disabled={pending || reason.trim().length < 5} onClick={go}>
        {pending ? '…' : `Crear borrador desde v${version}`}
      </button>
      <button type="button" className="uc-row-action" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error ? <span className="uc-cfg-err" role="alert">{error}</span> : null}
    </span>
  )
}
