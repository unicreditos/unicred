'use client'

import {
  getMySupportState,
  loadSupportThread,
  openMySupportChat,
  pulseSupportPresence,
  sendSupportMessage,
} from '@/app/actions/support'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { SupportCaseDTO, SupportMessageDTO } from '@/lib/support'
import { Headphones, Loader2, SendHorizonal } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'cobros', label: 'Cobros y cuotas' },
  { id: 'identidad', label: 'Identidad / Didit' },
  { id: 'desembolso', label: 'Desembolso' },
  { id: 'contrato', label: 'Contrato o pagaré' },
  { id: 'comercio', label: 'Comercio / liquidación' },
  { id: 'otro', label: 'Otro trámite' },
]

function formatWhen(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export function SupportThread({
  messages,
  myUserId,
  agentsOnline,
  lastAgentSeenAt,
  disabled,
  onSend,
  pending,
  variant = 'user',
}: {
  messages: SupportMessageDTO[]
  myUserId?: string
  agentsOnline: number
  lastAgentSeenAt?: string | null
  disabled?: boolean
  onSend: (body: string) => void
  pending?: boolean
  variant?: 'user' | 'ops'
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className={cn('flex flex-col', variant === 'ops' ? 'h-full min-h-0' : 'min-h-[420px]')}>
      <div className="border-b border-border px-4 py-3">
        {variant === 'ops' ? (
          <p className="text-xs font-medium text-muted-foreground">
            {agentsOnline > 1
              ? `${agentsOnline} operadores en el panel.`
              : 'Estás en línea. El cliente ve este chat y las notificaciones en tiempo real.'}
          </p>
        ) : agentsOnline > 0 ? (
          <p className="text-xs font-medium text-emerald-700">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {agentsOnline === 1 ? 'Hay un operador en línea' : `${agentsOnline} operadores en línea`}
          </p>
        ) : (
          <p className="text-xs font-medium text-amber-700">
            No hay operador en línea. Tu mensaje queda en cola; te avisamos en el panel cuando lo vean.
          </p>
        )}
        {lastAgentSeenAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Última vista de un operador: {formatWhen(lastAgentSeenAt)}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {!messages.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Escribí tu consulta. Podés gestionar cobros, identidad, desembolso o cualquier trámite de tu cuenta.
          </p>
        ) : (
          messages.map((msg) => {
            const mine =
              msg.kind !== 'system' &&
              (myUserId ? msg.authorUserId === myUserId : variant === 'ops' && msg.authorRole === 'admin')
            if (msg.kind === 'system') {
              return (
                <p key={msg.id} className="px-2 py-1 text-center text-[11px] text-muted-foreground">
                  {msg.body}
                </p>
              )
            }
            return (
              <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                    mine ? 'bg-brand-primary text-white' : 'bg-muted text-foreground',
                  )}
                >
                  <p className="text-[10px] font-semibold opacity-80">
                    {mine ? 'Vos' : msg.authorRole === 'admin' ? 'Operador' : msg.authorName}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted-foreground')}>
                    {formatWhen(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const body = draft.trim()
          if (!body || pending || disabled) return
          onSend(body)
          setDraft('')
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribí tu mensaje…"
          rows={2}
          disabled={disabled}
          className="min-h-[44px] resize-none"
        />
        <Button type="submit" size="icon" disabled={pending || disabled || !draft.trim()} aria-label="Enviar">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}

export function SupportChatPanel({
  audience,
  initialCaseId,
}: {
  audience: 'customer' | 'merchant'
  initialCaseId?: string
}) {
  const [agentsOnline, setAgentsOnline] = useState(0)
  const [cases, setCases] = useState<SupportCaseDTO[]>([])
  const [selected, setSelected] = useState<SupportCaseDTO | null>(null)
  const [thread, setThread] = useState<SupportMessageDTO[]>([])
  const [loans, setLoans] = useState<{ id: string; status: string; principal: string }[]>([])
  const [category, setCategory] = useState('cobros')
  const [loanId, setLoanId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()
  const selectedId = selected?.id

  const refresh = (caseId?: string) => {
    getMySupportState(caseId)
      .then((state) => {
        setAgentsOnline(state.agentsOnline)
        setCases(state.cases)
        setSelected(state.selected)
        setThread(state.thread)
        setLoans(state.loans)
        setMyUserId(state.selected?.userId)
      })
      .catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    refresh(initialCaseId)
  }, [initialCaseId])

  useEffect(() => {
    const tick = () => {
      void pulseSupportPresence(selectedId ?? null).then((r) => setAgentsOnline(r.agentsOnline))
      if (!selectedId) return
      loadSupportThread(selectedId, { markViewed: false })
        .then((r) => {
          setThread(r.thread)
          setAgentsOnline(r.agentsOnline)
        })
        .catch(() => null)
    }
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }, [selectedId])

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Headphones className="h-4 w-4 text-brand-primary" />
            Chat de soporte
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Trámites en línea desde el panel. Sin WhatsApp ni 0800.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v ?? 'cobros')}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter((c) => (audience === 'merchant' ? true : c.id !== 'comercio')).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loans.length ? (
            <Select value={loanId || '__none'} onValueChange={(v) => setLoanId(v === '__none' ? '' : (v ?? ''))}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Crédito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin crédito</SelectItem>
                {loans.map((loan) => (
                  <SelectItem key={loan.id} value={loan.id}>
                    {loan.status} · {loan.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>
      {cases.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b px-3 py-2">
          {cases.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelected(row)
                refresh(row.id)
              }}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                selected?.id === row.id ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground',
              )}
            >
              {row.channel === 'chat' ? 'Chat' : row.subject.slice(0, 28)}
              {row.unread ? <span className="ml-1 rounded-full bg-rose-500 px-1 text-[9px] text-white">{row.unread}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}
      <SupportThread
        messages={thread}
        myUserId={myUserId}
        agentsOnline={agentsOnline}
        lastAgentSeenAt={selected?.lastAgentSeenAt}
        pending={pending}
        onSend={(body) => {
          startTransition(async () => {
            try {
              const id = selected?.id ?? (await openMySupportChat({ category, relatedLoanId: loanId || null })).id
              await sendSupportMessage(id, body)
              refresh(id)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo enviar.')
            }
          })
        }}
      />
    </div>
  )
}

export function SupportPresenceBeacon({ viewingCaseId }: { viewingCaseId?: string | null }) {
  useEffect(() => {
    void pulseSupportPresence(viewingCaseId)
    const timer = setInterval(() => {
      void pulseSupportPresence(viewingCaseId)
    }, 25_000)
    return () => clearInterval(timer)
  }, [viewingCaseId])
  return null
}
