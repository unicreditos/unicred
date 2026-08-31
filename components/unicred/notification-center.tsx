'use client'

import type { InboxItem, InboxPayload } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { Bell, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const BADGE_POLL_MS = 15_000

function toneIcon(tone: InboxItem['tone']) {
  if (tone === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (tone === 'critical') return <CircleAlert className="h-4 w-4 text-rose-600" />
  if (tone === 'warn') return <CircleAlert className="h-4 w-4 text-amber-600" />
  return <Info className="h-4 w-4 text-brand-primary" />
}

function applyRead(inbox: InboxPayload, ids?: string[]): InboxPayload {
  const set = ids ? new Set(ids) : null
  const items = inbox.items.map((item) => ({
    ...item,
    unread: set ? (item.unread && !set.has(item.id)) : false,
  }))
  return { ...inbox, items, unreadHint: items.filter((item) => item.unread).length }
}

export function NotificationCenter() {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [inbox, setInbox] = useState<InboxPayload>({ items: [], stamp: '', unreadHint: 0 })
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
      setInbox((prev) => {
        const locallyRead = new Set(prev.items.filter((item) => item.unread === false).map((item) => item.id))
        const items = next.items.map((item) => ({
          ...item,
          unread: Boolean(item.unread) && !locallyRead.has(item.id),
        }))
        const unreadStamp = items.find((item) => item.unread)?.at ?? ''
        if (lastStamp.current && unreadStamp && unreadStamp !== lastStamp.current) {
          const fresh = items.find((item) => item.unread)
          if (fresh) toast.message(fresh.title, { description: fresh.detail })
        }
        if (unreadStamp) lastStamp.current = unreadStamp
        return { ...next, items, unreadHint: items.filter((item) => item.unread).length }
      })
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

    let source: EventSource | null = null
    if (typeof EventSource !== 'undefined') {
      source = new EventSource('/api/notifications/stream')
      source.onmessage = (event) => {
        try {
          apply(JSON.parse(event.data) as InboxPayload)
        } catch {
          /* payload incompleto */
        }
      }
    }

    return () => {
      clearInterval(poll)
      source?.close()
    }
  }, [])

  const markAll = () => {
    setInbox((prev) => applyRead(prev))
    void fetch('/api/notifications/read-all', { method: 'PUT' }).catch(() => null)
  }

  const markOne = (id: string) => {
    setInbox((prev) => applyRead(prev, [id]))
    void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' }).catch(() => null)
  }

  const unread = inbox.unreadHint

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && unread > 0) markAll()
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
            <button type="button" className="text-[11px] font-medium text-brand-primary" onClick={markAll}>
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
                    markOne(item.id)
                    setOpen(false)
                    router.push(item.href)
                    router.refresh()
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50',
                    item.unread ? 'bg-sky-50/50' : '',
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
