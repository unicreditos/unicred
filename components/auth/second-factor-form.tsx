'use client'

import { TotpPanel } from '@/components/auth/totp-panel'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

type Phase = 'idle' | 'sent' | 'expired' | 'locked'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function EmailPanel({ endpoint, next }: { endpoint: string; next: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const autoSent = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const cooldown = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0
  const expired = phase === 'sent' && expiresAt !== null && secondsLeft === 0
  const effective: Phase = expired ? 'expired' : phase

  const send = useCallback(async () => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${endpoint}/send`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429 && data.code === 'cooldown') {
        setResendAt(Date.now() + (Number(data.retryAfterSec) || 60) * 1000)
        setInfo('Ya te enviamos un código hace instantes. Revisá tu correo.')
        setPhase((p) => (p === 'idle' ? 'sent' : p))
        return
      }
      if (!res.ok || data.ok === false) throw new Error(data.message || 'No se pudo enviar el código.')
      setPhase('sent')
      setCode('')
      setExpiresAt(new Date(data.expiresAt).getTime())
      setResendAt(Date.now() + (Number(data.resendAfterSec) || 60) * 1000)
      setInfo('Te enviamos un código de 6 dígitos por correo.')
      inputRef.current?.focus()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [endpoint])

  // Al llegar a esta pantalla se envía el código una sola vez (el servidor aplica la espera mínima entre envíos).
  useEffect(() => {
    if (autoSent.current) return
    autoSent.current = true
    void send()
  }, [send])

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${endpoint}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        if (data.reason === 'locked') setPhase('locked')
        if (data.reason === 'expired') setPhase('expired')
        setCode('')
        throw new Error(data.message || 'Código incorrecto.')
      }
      window.location.assign(next)
    } catch (err) {
      setError((err as Error).message)
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const canResend = !busy && cooldown === 0
  const blocked = effective === 'expired' || effective === 'locked'

  return (
    <form className="uc-card uc-pad" onSubmit={verify} aria-labelledby="sf-title" style={{ display: 'grid', gap: 12, width: '100%' }} noValidate>
      <h1 id="sf-title" style={{ fontSize: 20, margin: 0 }}>Verificación en dos pasos</h1>
      <p className="uc-muted" style={{ margin: 0 }}>
        Para proteger tu cuenta, ingresá el código de 6 dígitos que enviamos a tu correo.
      </p>

      <label htmlFor="sf-code" style={{ fontWeight: 600 }}>Código de verificación</label>
      <input
        id="sf-code"
        ref={inputRef}
        className="uc-field"
        inputMode="numeric"
        pattern="[0-9]{6}"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={code}
        disabled={blocked}
        aria-invalid={error ? true : undefined}
        aria-describedby="sf-help sf-status"
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ minHeight: 44, fontSize: 20, letterSpacing: 6, textAlign: 'center', width: '100%' }}
        autoFocus
      />
      <span id="sf-help" className="uc-muted" style={{ fontSize: 13 }}>
        {effective === 'sent' && secondsLeft > 0 ? `El código vence en ${mmss(secondsLeft)}.` : 'El código vence a los 10 minutos y se usa una sola vez.'}
      </span>

      <button type="submit" className="uc-btn uc-primary" style={{ minHeight: 44 }} disabled={busy || code.length !== 6 || blocked}>
        {busy ? 'Verificando…' : 'Verificar'}
      </button>

      <div id="sf-status" aria-live="polite" style={{ display: 'grid', gap: 6 }}>
        {info ? <p className="uc-muted" style={{ margin: 0 }}>{info}</p> : null}
        {effective === 'expired' ? <p role="alert" style={{ margin: 0 }}>El código venció. Pedí uno nuevo.</p> : null}
        {effective === 'locked' ? <p role="alert" style={{ margin: 0 }}>Superaste los 5 intentos. Pedí un código nuevo.</p> : null}
        {error && effective !== 'expired' && effective !== 'locked' ? <p role="alert" style={{ margin: 0, color: 'var(--uc-danger, #b42318)' }}>{error}</p> : null}
        {error && (effective === 'expired' || effective === 'locked') && !/venci|intentos/i.test(error) ? <p role="alert" style={{ margin: 0 }}>{error}</p> : null}
      </div>

      <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={send} disabled={!canResend}>
        {cooldown > 0 ? `Reenviar código (${cooldown} s)` : phase === 'idle' ? 'Enviar código' : 'Reenviar código'}
      </button>
      <p className="uc-muted" style={{ margin: 0, fontSize: 12 }}>Al pedir un código nuevo, el anterior deja de servir. Máximo 5 envíos por hora.</p>
    </form>
  )
}
/** Elige el metodo: con app autenticadora activada se ofrece primero; el correo siempre queda como alternativa. */
export function SecondFactorForm({ endpoint, next, totpEnabled = false }: { endpoint: string; next: string; totpEnabled?: boolean }) {
  const [method, setMethod] = useState<'totp' | 'email'>(totpEnabled ? 'totp' : 'email')
  if (!totpEnabled) return <EmailPanel endpoint={endpoint} next={next} />
  return (
    <div style={{ display: 'grid', gap: 12, width: '100%' }}>
      <div role="group" aria-label="Método de verificación" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={method === 'totp' ? 'uc-btn uc-primary' : 'uc-btn'} style={{ minHeight: 44, flex: '1 1 150px' }} aria-pressed={method === 'totp'} onClick={() => setMethod('totp')}>
          App autenticadora
        </button>
        <button type="button" className={method === 'email' ? 'uc-btn uc-primary' : 'uc-btn'} style={{ minHeight: 44, flex: '1 1 150px' }} aria-pressed={method === 'email'} onClick={() => setMethod('email')}>
          Código por correo
        </button>
      </div>
      {method === 'totp' ? <TotpPanel next={next} /> : <EmailPanel endpoint={endpoint} next={next} />}
    </div>
  )
}
