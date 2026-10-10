'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Boton que llama a una API interna del panel (POST) y refresca la pantalla. */
export function ActionButton({ url, label, confirm }: { url: string; label: string; confirm?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.message || 'No se pudo completar la acción.')
      setMsg('Listo')
      router.refresh()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={run} disabled={busy}>
        {busy ? 'Procesando…' : label}
      </button>
      {msg ? <span role="status" className="uc-muted" style={{ fontSize: 12 }}>{msg}</span> : null}
    </span>
  )
}