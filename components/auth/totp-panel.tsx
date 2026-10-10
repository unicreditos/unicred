'use client'

import { useRef, useState, type FormEvent } from 'react'

/** Paso del ingreso con app autenticadora: codigo de 6 digitos o codigo de respaldo. */
export function TotpPanel({ next }: { next: string }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || code.trim().length < 6) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/2fa/totp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setCode('')
        throw new Error(data.message || 'Código incorrecto.')
      }
      if (data.method === 'backup_code') setInfo(`Usaste un código de respaldo. Te quedan ${data.backupRemaining ?? 0}.`)
      window.location.assign(next)
    } catch (err) {
      setError((err as Error).message)
      ref.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="uc-card uc-pad" onSubmit={submit} aria-labelledby="tp-title" style={{ display: 'grid', gap: 12, width: '100%' }} noValidate>
      <h1 id="tp-title" style={{ fontSize: 20, margin: 0 }}>Verificación en dos pasos</h1>
      <p className="uc-muted" style={{ margin: 0 }}>Abrí tu app autenticadora e ingresá el código de 6 dígitos. Si no la tenés a mano, usá un código de respaldo.</p>
      <label htmlFor="tp-code" style={{ fontWeight: 600 }}>Código de la app o de respaldo</label>
      <input
        id="tp-code"
        ref={ref}
        className="uc-field"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        placeholder="000000"
        value={code}
        aria-invalid={error ? true : undefined}
        aria-describedby="tp-status"
        onChange={(e) => setCode(e.target.value)}
        style={{ minHeight: 44, fontSize: 20, letterSpacing: 4, textAlign: 'center', width: '100%' }}
        autoFocus
      />
      <button type="submit" className="uc-btn uc-primary" style={{ minHeight: 44 }} disabled={busy || code.trim().length < 6}>
        {busy ? 'Verificando…' : 'Verificar'}
      </button>
      <div id="tp-status" aria-live="polite">
        {info ? <p className="uc-muted" style={{ margin: 0 }}>{info}</p> : null}
        {error ? <p role="alert" style={{ margin: 0, color: 'var(--uc-danger, #b42318)' }}>{error}</p> : null}
      </div>
    </form>
  )
}