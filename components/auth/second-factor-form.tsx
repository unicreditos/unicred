'use client'

import { useState } from 'react'

export function SecondFactorForm({ endpoint, next }: { endpoint: string; next: string }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function call(path: 'send' | 'verify') {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`${endpoint}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: path === 'verify' ? JSON.stringify({ code }) : '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.message || 'No se pudo completar el paso.')
      if (path === 'send') {
        setSent(true)
        setMsg('Te enviamos un código de 6 dígitos por correo. Vence en 10 minutos.')
      } else {
        window.location.assign(next)
      }
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="uc-card uc-pad" style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Verificación en dos pasos</h1>
      <p className="uc-muted" style={{ margin: 0 }}>Para proteger tu cuenta, confirmá que sos vos con un código que enviamos a tu correo.</p>
      <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={() => call('send')} disabled={busy}>
        {sent ? 'Reenviar código' : 'Enviar código al correo'}
      </button>
      <input
        className="uc-field"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        aria-label="Código de 6 dígitos"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ minHeight: 44 }}
      />
      <button type="button" className="uc-btn uc-primary" style={{ minHeight: 44 }} onClick={() => call('verify')} disabled={busy || code.length !== 6}>
        Verificar
      </button>
      {msg ? <p role="status" className="uc-muted" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  )
}