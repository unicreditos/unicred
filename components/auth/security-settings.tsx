'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Status = { totpEnabled: boolean; totpPending: boolean; backupRemaining: number }
type Sess = { id: string; device: string; ip: string | null; lastSeen: string; createdAt: string; current: boolean }
type Mode = 'idle' | 'begin' | 'scan' | 'codes' | 'disable' | 'regen'

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
const when = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
const field = { minHeight: 44, width: '100%' } as const

export function SecuritySettings() {
  const [st, setSt] = useState<Status | null>(null)
  const [sessions, setSessions] = useState<Sess[] | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await fetch('/api/2fa/status', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    if (s?.ok) setSt({ totpEnabled: s.totpEnabled, totpPending: s.totpPending, backupRemaining: s.backupRemaining })
    const l = await fetch('/api/account/sessions', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    setSessions(l?.ok ? l.sessions : [])
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function reset(next: Mode = 'idle') {
    setMode(next)
    setPassword('')
    setCode('')
    setErr(null)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const begin = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const r = await post('/api/2fa/totp/begin', { password })
      if (!r.ok) throw new Error(r.data.message || 'No se pudo empezar.')
      setQr({ qr: r.data.qr, secret: r.data.secret })
      reset('scan')
    })
  }
  const confirm = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const r = await post('/api/2fa/totp/confirm', { code })
      if (!r.ok) throw new Error(r.data.message || 'Código incorrecto.')
      setCodes(r.data.backupCodes)
      setQr(null)
      reset('codes')
      setMsg('Listo: la app autenticadora quedó activada.')
      await load()
    })
  }
  const disable = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const r = await post('/api/2fa/totp/disable', { password, code })
      if (!r.ok) throw new Error(r.data.message || 'No se pudo desactivar.')
      reset()
      setMsg('Desactivaste la app autenticadora. Seguís pudiendo verificar por correo.')
      await load()
    })
  }
  const regen = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const r = await post('/api/2fa/totp/regenerate', { password, code })
      if (!r.ok) throw new Error(r.data.message || 'No se pudieron regenerar.')
      setCodes(r.data.backupCodes)
      reset('codes')
      setMsg('Generamos códigos nuevos. Los anteriores ya no sirven.')
      await load()
    })
  }
  const revoke = (body: { id?: string; all?: boolean }) =>
    void run(async () => {
      const r = await post('/api/account/sessions', body)
      if (!r.ok) throw new Error(r.data.message || 'No se pudo cerrar.')
      setMsg(body.all ? `Cerraste ${r.data.count} sesión(es) en otros dispositivos.` : 'Cerraste esa sesión.')
      await load()
    })

  const download = () => {
    if (!codes) return
    const blob = new Blob([`UNICREDITOS - códigos de respaldo (cada uno sirve una sola vez)\n\n${codes.join('\n')}\n`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'unicreditos-codigos-respaldo.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const others = (sessions ?? []).filter((s) => !s.current)

  return (
    <div style={{ display: 'grid', gap: 20, width: '100%', maxWidth: 720 }}>
      <div aria-live="polite">
        {msg ? <p role="status" className="uc-card uc-pad" style={{ margin: 0 }}>{msg}</p> : null}
        {err ? <p role="alert" className="uc-card uc-pad" style={{ margin: 0, color: 'var(--uc-danger, #b42318)' }}>{err}</p> : null}
      </div>

      <section className="uc-card uc-pad" aria-labelledby="ss-totp" style={{ display: 'grid', gap: 12 }}>
        <h2 id="ss-totp" style={{ fontSize: 18, margin: 0 }}>App autenticadora (TOTP)</h2>
        <p className="uc-muted" style={{ margin: 0 }}>
          Agregá una segunda llave a tu cuenta con Google Authenticator, Microsoft Authenticator, Authy o similar. La verificación por correo sigue disponible como alternativa.
        </p>
        {!st ? <p className="uc-muted">Cargando…</p> : null}

        {st && !st.totpEnabled && mode === 'idle' ? (
          <button className="uc-btn uc-primary" style={{ minHeight: 44 }} onClick={() => reset('begin')}>Activar app autenticadora</button>
        ) : null}
        {st?.totpEnabled && mode === 'idle' ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0 }}><strong>Activada.</strong> Códigos de respaldo disponibles: {st.backupRemaining}.</p>
            {st.backupRemaining <= 2 ? <p role="alert" style={{ margin: 0 }}>Te quedan pocos códigos de respaldo: generá nuevos.</p> : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="uc-btn" style={{ minHeight: 44 }} onClick={() => reset('regen')}>Regenerar códigos de respaldo</button>
              <button className="uc-btn" style={{ minHeight: 44 }} onClick={() => reset('disable')}>Desactivar</button>
            </div>
          </div>
        ) : null}

        {mode === 'begin' ? (
          <form onSubmit={begin} style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="ss-pw" style={{ fontWeight: 600 }}>Confirmá tu contraseña para continuar</label>
            <input id="ss-pw" type="password" autoComplete="current-password" className="uc-field" style={field} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="uc-btn uc-primary" style={{ minHeight: 44 }} disabled={busy || !password}>Continuar</button>
              <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={() => reset()}>Cancelar</button>
            </div>
          </form>
        ) : null}

        {mode === 'scan' && qr ? (
          <form onSubmit={confirm} style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>1. Escaneá este código QR con tu app (o cargá la clave a mano). 2. Ingresá el código de 6 dígitos que muestra.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr} alt="Código QR para la app autenticadora" width={220} height={220} style={{ maxWidth: '100%', height: 'auto', background: '#fff', padding: 8, borderRadius: 8, justifySelf: 'start' }} />
            <p className="uc-muted" style={{ margin: 0, fontSize: 13 }}>Clave manual: <code style={{ wordBreak: 'break-all' }}>{qr.secret}</code></p>
            <label htmlFor="ss-code" style={{ fontWeight: 600 }}>Código de 6 dígitos</label>
            <input id="ss-code" className="uc-field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" style={{ ...field, fontSize: 20, letterSpacing: 6, textAlign: 'center' }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="uc-btn uc-primary" style={{ minHeight: 44 }} disabled={busy || code.length !== 6}>Confirmar y activar</button>
              <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={() => { setQr(null); reset() }}>Cancelar</button>
            </div>
          </form>
        ) : null}

        {mode === 'codes' && codes ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <p role="alert" style={{ margin: 0 }}><strong>Guardá estos códigos ahora.</strong> Cada uno sirve una sola vez y no volverás a verlos.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, fontFamily: 'monospace', fontSize: 16 }}>
              {codes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="uc-btn" style={{ minHeight: 44 }} onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>Copiar</button>
              <button className="uc-btn" style={{ minHeight: 44 }} onClick={download}>Descargar .txt</button>
              <button className="uc-btn uc-primary" style={{ minHeight: 44 }} onClick={() => { setCodes(null); reset() }}>Ya los guardé</button>
            </div>
          </div>
        ) : null}

        {mode === 'disable' || mode === 'regen' ? (
          <form onSubmit={mode === 'disable' ? disable : regen} style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>Por seguridad, confirmá tu contraseña y un código vigente (de la app o de respaldo).</p>
            <label htmlFor="ss-pw2" style={{ fontWeight: 600 }}>Contraseña</label>
            <input id="ss-pw2" type="password" autoComplete="current-password" className="uc-field" style={field} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <label htmlFor="ss-code2" style={{ fontWeight: 600 }}>Código de la app o de respaldo</label>
            <input id="ss-code2" className="uc-field" autoComplete="one-time-code" spellCheck={false} maxLength={12} style={field} value={code} onChange={(e) => setCode(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="uc-btn uc-primary" style={{ minHeight: 44 }} disabled={busy || !password || code.trim().length < 6}>{mode === 'disable' ? 'Desactivar' : 'Regenerar'}</button>
              <button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={() => reset()}>Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="uc-card uc-pad" aria-labelledby="ss-sess" style={{ display: 'grid', gap: 12 }}>
        <h2 id="ss-sess" style={{ fontSize: 18, margin: 0 }}>Sesiones activas</h2>
        <p className="uc-muted" style={{ margin: 0 }}>Si no reconocés un dispositivo, cerrá esa sesión y cambiá tu contraseña. En cuentas de clientes el cierre puede tardar hasta 5 minutos en notarse.</p>
        {sessions === null ? <p className="uc-muted">Cargando…</p> : null}
        {sessions?.length === 0 ? <p className="uc-muted">No hay sesiones para mostrar.</p> : null}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {(sessions ?? []).map((s) => (
            <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--uc-border, #e5e7eb)', paddingTop: 10 }}>
              <div style={{ minWidth: 0 }}>
                <strong>{s.device}</strong> {s.current ? <span className="uc-muted">(esta sesión)</span> : null}
                <div className="uc-muted" style={{ fontSize: 13 }}>IP {s.ip ?? 'desconocida'} · última actividad {when(s.lastSeen)} · inició {when(s.createdAt)}</div>
              </div>
              {!s.current ? <button className="uc-btn" style={{ minHeight: 44 }} disabled={busy} onClick={() => revoke({ id: s.id })} aria-label={`Cerrar la sesión de ${s.device}`}>Cerrar sesión</button> : null}
            </li>
          ))}
        </ul>
        {others.length > 0 ? <button className="uc-btn" style={{ minHeight: 44, justifySelf: 'start' }} disabled={busy} onClick={() => revoke({ all: true })}>Cerrar todas las demás ({others.length})</button> : null}
      </section>
    </div>
  )
}