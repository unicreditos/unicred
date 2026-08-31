'use client'

import {
  getAdminSupportDesk,
  loadSupportThread,
  pulseSupportPresence,
  resolveSupportCase,
  sendSupportMessage,
} from '@/app/actions/support'
import { SupportThread } from '@/components/support/support-chat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SupportCaseDTO, SupportMessageDTO } from '@/lib/support'
import { cn } from '@/lib/utils'
import { Headphones, Loader2, Scale } from 'lucide-react'
import Link from 'next/link'
import { OpsFloor } from '@/components/unicred/workspace-shell'
import { useEffect, useState, useTransition } from 'react'

const STATUS: Record<string, string> = {
  open: 'Abierto',
  in_review: 'En atención',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const CATEGORY: Record<string, string> = {
  cobros: 'Cobros',
  identidad: 'Identidad',
  desembolso: 'Desembolso',
  contrato: 'Contrato',
  comercio: 'Comercio',
  otro: 'Otro',
  mobile_chat: 'App',
}

export function AdminClaimsDesk() {
  const [initialCaseId, setInitialCaseId] = useState<string | undefined>()
  const [cases, setCases] = useState<SupportCaseDTO[]>([])
  const [selected, setSelected] = useState<SupportCaseDTO | null>(null)
  const [thread, setThread] = useState<SupportMessageDTO[]>([])
  const [agentsOnline, setAgentsOnline] = useState(0)
  const [closeNote, setCloseNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const selectedId = selected?.id

  useEffect(() => {
    setInitialCaseId(new URLSearchParams(window.location.search).get('case') ?? undefined)
  }, [])

  const refreshList = (caseId?: string) => {
    getAdminSupportDesk(caseId)
      .then((state) => {
        setCases(state.cases)
        setAgentsOnline(state.agentsOnline)
        if (state.selected) {
          setSelected(state.selected)
          setThread(state.thread)
        } else if (caseId) {
          const row = state.cases.find((c) => c.id === caseId) ?? null
          setSelected(row)
        }
      })
      .catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    refreshList(initialCaseId)
  }, [initialCaseId])

  useEffect(() => {
    void pulseSupportPresence(selectedId ?? undefined)
    const beat = setInterval(() => {
      void pulseSupportPresence(selectedId ?? undefined).then((r) => setAgentsOnline(r.agentsOnline))
    }, 25_000)
    return () => clearInterval(beat)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    const tick = () => {
      loadSupportThread(selectedId, { markViewed: false })
        .then((r) => {
          setThread(r.thread)
          setAgentsOnline(r.agentsOnline)
        })
        .catch(() => null)
    }
    const threadTimer = setInterval(tick, 4000)
    const listTimer = setInterval(() => {
      getAdminSupportDesk()
        .then((state) => setCases(state.cases))
        .catch(() => null)
    }, 12_000)
    return () => {
      clearInterval(threadTimer)
      clearInterval(listTimer)
    }
  }, [selectedId])

  const open = cases.filter((c) => c.status === 'open' || c.status === 'in_review').length

  return (
    <OpsFloor>
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
            <Headphones className="h-4 w-4 text-brand-primary" />
            Mesa de soporte
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Chat en línea y reclamos Ley 24.240. {open} trámite{open === 1 ? '' : 's'} abierto{open === 1 ? '' : 's'}.
            {agentsOnline ? ` · ${agentsOnline} operador${agentsOnline === 1 ? '' : 'es'} en línea.` : ' · Nadie más en línea.'}
          </p>
        </div>
      </div>
      {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
        <div className="min-h-0 overflow-y-auto lg:col-span-4">
          {!cases.length ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No hay trámites todavía.
            </p>
          ) : (
            cases.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelected(row)
                  refreshList(row.id)
                }}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition hover:border-brand-primary/40',
                  selected?.id === row.id ? 'border-brand-primary bg-brand-primary-50/40' : 'bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.userName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.subject}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {row.unread > 0 ? (
                      <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{row.unread}</span>
                    ) : null}
                    <span className="text-[10px] font-semibold text-slate-500">{STATUS[row.status] ?? row.status}</span>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-slate-500">{row.lastPreview}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {CATEGORY[row.category] ?? row.category} · {row.channel === 'chat' ? 'Chat' : 'Reclamo'}
                  {row.lastMessageAt ? ` · ${new Date(row.lastMessageAt).toLocaleString('es-AR')}` : ''}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white lg:col-span-8">
          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{selected.userName}</p>
                  <p className="text-[12px] text-muted-foreground">{selected.userEmail}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {selected.subject} · {CATEGORY[selected.category] ?? selected.category}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/clientes/${selected.userId}`}>Ficha</Link>
                  </Button>
                  {selected.relatedLoanId ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/creditos/${selected.relatedLoanId}`}>Crédito</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <SupportThread
                  messages={thread}
                  agentsOnline={agentsOnline}
                  lastAgentSeenAt={selected.lastAgentSeenAt}
                  pending={pending}
                  variant="ops"
                  onSend={(body) => {
                    startTransition(async () => {
                      try {
                        await sendSupportMessage(selected.id, body)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'No se pudo enviar.')
                      }
                    })
                  }}
                />
              </div>
              {selected.status !== 'resolved' && selected.status !== 'closed' ? (
                <div className="shrink-0 space-y-2 border-t px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Scale className="h-3.5 w-3.5" /> Cerrar trámite / reclamo formal
                  </p>
                  <Textarea
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="Nota de cierre (opcional). Si escribís, también queda en el chat."
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await resolveSupportCase(selected.id, closeNote)
                          setCloseNote('')
                          refreshList(selected.id)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'No se pudo cerrar.')
                        }
                      })
                    }}
                    className="gap-1.5"
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Cerrar trámite
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">Elegí un trámite a la izquierda para atenderlo.</p>
          )}
        </div>
      </div>
    </OpsFloor>
  )
}
