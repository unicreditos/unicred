'use client'

import {
  getMyDiditSession,
  startDiditSignupVerification,
  startDiditVerification,
  syncDiditSession,
} from '@/app/actions/didit'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  mode: 'signup' | 'session'
  fullName?: string
  dni?: string
  birthDate?: string
  phone?: string
  email?: string
  label?: string
  className?: string
  onStarted?: (sessionId: string) => void
  onCompleted?: (status: string) => void
  onError?: (message: string) => void
}

const TERMINAL = new Set(['Approved', 'Declined', 'In Review', 'Abandoned', 'Kyc Expired'])

function isDiditOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'didit.me' || hostname.endsWith('.didit.me')
  } catch {
    return false
  }
}

function parseDiditEnvelope(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const envelope = raw as { type?: unknown; data?: unknown; status?: unknown }
  if (typeof envelope.type !== 'string' || !envelope.type.startsWith('didit:')) return null
  const inner =
    envelope.data && typeof envelope.data === 'object' && 'data' in envelope.data
      ? (envelope.data as { data: unknown }).data
      : envelope.data
  const data = inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {}
  return { type: envelope.type, data, status: typeof envelope.status === 'string' ? envelope.status : undefined }
}

function statusLabel(status: string) {
  switch (status) {
    case 'Approved':
      return 'Identidad verificada'
    case 'Declined':
      return 'Didit rechazó la verificación'
    case 'In Review':
      return 'Didit dejó el caso en revisión'
    case 'Abandoned':
      return 'La sesión se abandonó'
    case 'Resubmitted':
      return 'Didit pidió que reintentés'
    case 'In Progress':
      return 'Verificación en curso'
    default:
      return status || 'Verificación recibida'
  }
}

export function DiditVerifyButton({
  mode,
  fullName,
  dni,
  birthDate,
  phone,
  email,
  label = 'Verificar identidad',
  className,
  onStarted,
  onCompleted,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resultStatus, setResultStatus] = useState<string | null>(null)
  const onStartedRef = useRef(onStarted)
  const onCompletedRef = useRef(onCompleted)
  const onErrorRef = useRef(onError)
  const completedRef = useRef(false)
  useEffect(() => {
    onStartedRef.current = onStarted
    onCompletedRef.current = onCompleted
    onErrorRef.current = onError
  })

  const finish = useCallback(async (id: string, hinted?: string) => {
    const res = await syncDiditSession(id).catch(() => null)
    const status = res && 'status' in res && res.status ? String(res.status) : hinted || ''
    if (!status) return
    setResultStatus(status)
    if (TERMINAL.has(status) && !completedRef.current) {
      completedRef.current = true
      onCompletedRef.current?.(status)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onMessage(event: MessageEvent) {
      const fromDidit = isDiditOrigin(event.origin)
      const fromSelf = event.origin === window.location.origin
      if (!fromDidit && !fromSelf) return

      const parsed = parseDiditEnvelope(event.data)
      if (!parsed) return

      if (parsed.type === 'didit:unicred-return') {
        const id = sessionId || (typeof parsed.data.sessionId === 'string' ? parsed.data.sessionId : null)
        if (id) void finish(id, parsed.status || String(parsed.data.status ?? ''))
        return
      }

      if (!fromDidit) return

      const hinted = typeof parsed.data.status === 'string' ? parsed.data.status : undefined
      const id = sessionId || (typeof parsed.data.sessionId === 'string' ? parsed.data.sessionId : null)

      if (parsed.type === 'didit:completed' || parsed.type === 'didit:status_updated') {
        if (id) void finish(id, hinted)
        return
      }
      if (parsed.type === 'didit:close_request' || parsed.type === 'didit:cancelled') {
        if (id) void finish(id, hinted)
        setOpen(false)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open, sessionId, finish])

  useEffect(() => {
    if (!open || !sessionId || (resultStatus && TERMINAL.has(resultStatus))) return
    const tick = window.setInterval(() => {
      void finish(sessionId)
    }, 4000)
    return () => window.clearInterval(tick)
  }, [open, sessionId, resultStatus, finish])

  async function start() {
    setLoading(true)
    setResultStatus(null)
    completedRef.current = false
    try {
      const existing = await getMyDiditSession().catch(() => null)
      if (existing?.url && existing.sessionId && !TERMINAL.has(String(existing.status ?? ''))) {
        setSessionId(existing.sessionId)
        setUrl(existing.url)
        setOpen(true)
        onStartedRef.current?.(existing.sessionId)
        return
      }

      const result =
        mode === 'signup'
          ? await startDiditSignupVerification({
              fullName: fullName?.trim() || undefined,
              dni,
              birthDate,
              phone,
              email,
            })
          : await startDiditVerification({ fullName, dni, birthDate, phone, email })
      if (!result.ok) {
        onErrorRef.current?.(result.error)
        return
      }
      setSessionId(result.sessionId)
      setUrl(result.url)
      setOpen(true)
      onStartedRef.current?.(result.sessionId)
    } catch (err) {
      onErrorRef.current?.((err as Error).message || 'No se pudo abrir la verificación.')
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setOpen(false)
    if (sessionId) void finish(sessionId)
  }

  return (
    <>
      <Button type="button" className={className} disabled={loading} onClick={() => void start()}>
        {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {resultStatus && TERMINAL.has(resultStatus) ? 'Reintentar verificación' : label}
      </Button>
      {resultStatus && !open && (
        <p
          className={
            resultStatus === 'Approved'
              ? 'text-sm text-emerald-700 dark:text-emerald-400'
              : 'text-sm text-muted-foreground'
          }
        >
          {statusLabel(resultStatus)}. Seguís en UNICRÉDITOS.
        </p>
      )}

      {open && url && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-background">
          <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
            <div className="min-w-0">
              <BrandLogo showText className="h-7" />
              <p className="mt-1 text-xs text-muted-foreground">
                Verificación dentro de UNICRÉDITOS
                {resultStatus ? ` · ${statusLabel(resultStatus)}` : ' · DNI y prueba de vida'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              <X />
              {resultStatus && TERMINAL.has(resultStatus) ? 'Listo' : 'Cerrar'}
            </Button>
          </header>
          <iframe
            title="Verificación de identidad UNICRÉDITOS"
            src={url}
            className="min-h-0 w-full flex-1 border-0 bg-background"
            allow="camera; microphone; fullscreen; autoplay; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </>
  )
}
