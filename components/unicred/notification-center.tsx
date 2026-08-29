'use client'

import type { InboxItem, InboxPayload } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { Bell, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

const SEEN_KEY = 'uc-inbox-seen'
const BADGE_POLL_MS = 60_000

function toneIcon(tone: InboxItem['tone']) {
  if (tone === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (tone === 'critical') return <CircleAlert className="h-4 w-4 text-rose-600" />
  if (tone === 'warn') return <CircleAlert className="h-4 w-4 text-amber-600" />
  return <Info className="h-4 w-4 text-brand-primary" />
}

export function NotificationCenter() {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [inbox, setInbox] = useState<InboxPayload>({ items: [], stamp: '', unreadHint: 0 })
  const seen = useSyncExternalStore(
    (onStore) => {
      window.addEventListener('storage', onStore)
      window.addEventListener('uc-storage', onStore)
      return () => {
        window.removeEventListener('storage', onStore)
        window.removeEventListener('uc-storage', onStore)
      }
    },
    () => window.localStorage.getItem(SEEN_KEY) ?? '',
    () => '',
  )
  const lastStamp = useRef('')

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    const apply = (next: InboxPayload) => {
      setInbox(next)
      if (lastStamp.current && next.stamp && next.stamp !== lastStamp.current) {
        const fresh = next.items[0]
        if (fresh) toast.message(fresh.title, { description: fresh.detail })
      }
      lastStamp.current = next.stamp
    }

    const pull = () =>
      fetch('/api/notifications')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) apply(data)
        })
        .catch(() => null)

    void pull()
    const poll = setInterval(() => {
      void pull()
    }, BADGE_POLL_MS)

    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    if (!open) return
    let source: EventSource | null = null
    if (typeof EventSource === 'undefined') return
    source = new EventSource('/api/notifications/stream')
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as InboxPayload
        setInbox(next)
        lastStamp.current = next.stamp
      } catch {
        /* payload incompleto */
      }
    }
    return () => source?.close()
  }, [open])

  const unread = useMemo(() => {
    if (!seen) return inbox.items.length
    return inbox.items.filter((item) => item.at > seen).length
  }, [inbox.items, seen])

  const markRead = () => {
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString())
    window.dispatchEvent(new Event('uc-storage'))
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) markRead()
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-6 w-6" strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-brand-navy-900">Notificaciones</p>
            <button type="button" className="text-[11px] font-medium text-brand-primary" onClick={markRead}>
              Marcar leídas
            </button>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {inbox.items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">Sin novedades en tu cuenta.</p>
            ) : (
              inbox.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push(item.href)
                    router.refresh()
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50',
                    !seen || item.at > seen ? 'bg-sky-50/50' : '',
                  )}
                >
                  <span className="mt-0.5">{toneIcon(item.tone)}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-brand-navy-900">{item.title}</span>
                    <span className="block text-[11px] text-slate-500">{item.detail}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {new Date(item.at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
