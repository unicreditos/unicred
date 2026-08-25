'use client'

import { SectionCard } from '@/components/unicred/dashboard-kit'
import type { InboxItem, InboxPayload } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { BellRing, CheckCircle2, CircleAlert, Info, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

function toneIcon(tone: InboxItem['tone']) {
  if (tone === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (tone === 'critical') return <CircleAlert className="h-4 w-4 text-rose-600" />
  if (tone === 'warn') return <CircleAlert className="h-4 w-4 text-amber-600" />
  return <Info className="h-4 w-4 text-brand-primary" />
}

export function ActivityInbox({ onOpenHref }: { onOpenHref: (href: string) => void }) {
  const [inbox, setInbox] = useState<InboxPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar la actividad.'))))
      .then((data) => {
        if (!cancelled) setInbox(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SectionCard
      title="Actividad"
      description="Vencimientos, pagos, desembolsos y reclamos de tu cuenta."
      icon={<BellRing className="h-4.5 w-4.5 text-brand-primary" />}
    >
      {!inbox && !error ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando movimientos…
        </p>
      ) : error ? (
        <p className="py-6 text-sm text-destructive">{error}</p>
      ) : !inbox?.items.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin novedades en tu cuenta.</p>
      ) : (
        <div className="space-y-2">
          {inbox.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenHref(item.href)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background p-4 text-left transition hover:border-brand-primary/30 hover:bg-brand-primary-50/30',
              )}
            >
              <span className="mt-0.5">{toneIcon(item.tone)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
                <span className="mt-1 block text-[11px] text-slate-400">
                  {new Date(item.at).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
