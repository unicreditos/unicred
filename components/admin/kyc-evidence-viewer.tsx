'use client'

import { useCallback, useEffect, useState } from 'react'

type Item = { id: string; kind: string; version: number; mime: string; sizeBytes: number; sha256: string; source: string; capturedAt: string }
type Access = { at: string; kind: string; version: number | null; outcome: string; ip: string | null; actorEmail: string | null; actorName: string | null }

const LABEL: Record<string, string> = { dni_front: 'DNI frente', dni_back: 'DNI dorso', selfie: 'Selfie', video: 'Video de prueba de vida' }
const OUTCOME: Record<string, string> = { served: 'Visto', denied_2fa: 'Bloqueado (sin 2FA)', hash_mismatch: 'Integridad fallida', not_found: 'No encontrado' }

function when(v: string) {
  return new Date(v).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export function KycEvidenceViewer({ userId }: { userId: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [access, setAccess] = useState<Access[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ kind: string; version: number } | null>(null)
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<{ url: string; mime: string; label: string; sha: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/kyc-evidence/${userId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'No se pudo cargar la evidencia.')
      setItems(data.items)
      setAccess(data.access)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Carga inicial desde la API (estado externo); el setState ocurre despu\u00e9s del await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => () => { if (shown) URL.revokeObjectURL(shown.url) }, [shown])

  async function open(kind: string, version: number) {
    setBusy(true)
    setInfo(null)
    setPending({ kind, version })
    try {
      const res = await fetch(`/api/admin/kyc-evidence/${userId}/${kind}?v=${version}`, { cache: 'no-store' })
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.code === '2FA_REQUIRED') {
          setNeedsCode(true)
          setInfo(data.message)
          return
        }
        throw new Error(data.message || 'Sin permiso.')
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'No se pudo abrir el documento.')
      }
      const blob = await res.blob()
      setShown((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { url: URL.createObjectURL(blob), mime: blob.type, label: `${LABEL[kind] ?? kind} (v${version})`, sha: res.headers.get('X-Evidence-SHA256') ?? '' }
      })
      setNeedsCode(false)
      setError(null)
      void load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendCode() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/2fa/send', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'No se pudo enviar el código.')
      setInfo('Te enviamos un código de 6 dígitos por correo. Vence en 10 minutos.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/2fa/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Código incorrecto.')
      setCode('')
      setNeedsCode(false)
      if (pending) await open(pending.kind, pending.version)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="uc-stack" style={{ display: 'grid', gap: 16 }}>
      {error ? <div role="alert" className="uc-card" style={{ padding: 12, color: 'var(--uc-danger, #b42318)' }}>{error}</div> : null}

      {needsCode ? (
        <div className="uc-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <strong>Verificación en dos pasos</strong>
          <span className="uc-muted">{info ?? 'Para ver documentos de identidad ingresá el código que enviamos a tu correo.'}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="uc-btn" onClick={sendCode} disabled={busy}>Enviar código al correo</button>
            <input
              className="uc-field"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              aria-label="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ width: 120, minHeight: 44 }}
            />
            <button type="button" className="uc-btn uc-primary" onClick={verify} disabled={busy || code.length !== 6}>Verificar</button>
          </div>
        </div>
      ) : null}

      <div className="uc-card" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Documentos y versiones</h2>
        {loading ? <p className="uc-muted">Cargando…</p> : null}
        {!loading && items.length === 0 ? <p className="uc-muted">Este cliente no tiene documentos de identidad guardados.</p> : null}
        <div style={{ overflowX: 'auto' }}>
          {items.length ? (
            <table className="uc-dt">
              <thead>
                <tr><th>Documento</th><th>Versión</th><th>Capturado</th><th>Origen</th><th>Tamaño</th><th>SHA-256</th><th><span className="uc-sr-only">Acción</span></th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td data-label="Documento">{LABEL[it.kind] ?? it.kind}</td>
                    <td data-label="Versión">v{it.version}</td>
                    <td data-label="Capturado">{when(it.capturedAt)}</td>
                    <td data-label="Origen">{it.source}</td>
                    <td data-label="Tamaño">{Math.round(it.sizeBytes / 1024)} KB</td>
                    <td data-label="SHA-256"><code title={it.sha256}>{it.sha256.slice(0, 12)}…</code></td>
                    <td><button type="button" className="uc-btn" style={{ minHeight: 44 }} onClick={() => open(it.kind, it.version)} disabled={busy}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {shown ? (
        <div className="uc-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{shown.label}</strong>
            <button type="button" className="uc-btn" onClick={() => setShown(null)}>Cerrar</button>
          </div>
          {shown.mime.startsWith('video/') ? (
            <video src={shown.url} controls style={{ maxWidth: '100%', maxHeight: '70vh' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.url} alt={shown.label} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
          )}
          <span className="uc-muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>Integridad verificada · SHA-256 {shown.sha}</span>
        </div>
      ) : null}

      <div className="uc-card" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Quién lo vio</h2>
        {access.length === 0 ? <p className="uc-muted">Todavía nadie abrió estos documentos.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="uc-dt">
              <thead><tr><th>Cuándo</th><th>Operador</th><th>Documento</th><th>Resultado</th><th>IP</th></tr></thead>
              <tbody>
                {access.map((a, i) => (
                  <tr key={i}>
                    <td data-label="Cuándo">{when(a.at)}</td>
                    <td data-label="Operador">{a.actorName || a.actorEmail || '—'}</td>
                    <td data-label="Documento">{LABEL[a.kind] ?? a.kind}{a.version ? ` v${a.version}` : ''}</td>
                    <td data-label="Resultado">{OUTCOME[a.outcome] ?? a.outcome}</td>
                    <td data-label="IP">{a.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}