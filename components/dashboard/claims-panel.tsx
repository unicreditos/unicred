'use client'

import { createClaim } from '@/app/actions/claims'
import { SupportChatPanel } from '@/components/support/support-chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { Scale, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'cobros', label: 'Cobros y cuotas' },
  { id: 'identidad', label: 'Identidad / Didit' },
  { id: 'desembolso', label: 'Desembolso' },
  { id: 'contrato', label: 'Contrato o pagaré' },
  { id: 'otro', label: 'Otro' },
]

export function ClaimsPanel() {
  const [initialCaseId, setInitialCaseId] = useState<string | undefined>()
  useEffect(() => {
    // Lee ?case= recién montado: window no existe en el render de servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialCaseId(new URLSearchParams(window.location.search).get('case') ?? undefined)
  }, [])
  const [category, setCategory] = useState('cobros')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <SupportChatPanel audience="customer" initialCaseId={initialCaseId} />
      </div>
      <SectionCard
        title="Reclamo formal Ley 24.240"
        description="Expediente con plazo de 10 días hábiles. El chat de al lado sirve para el mismo trámite en línea."
        icon={<Scale className="h-4 w-4 text-brand-primary" />}
        className="lg:col-span-5"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            setOk(null)
            startTransition(async () => {
              try {
                const r = await createClaim({ category, subject, body })
                setSubject('')
                setBody('')
                setOk(`Reclamo ${r.id.slice(0, 12)} registrado. Queda también en el chat.`)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo registrar el reclamo.')
              }
            })
          }}
        >
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? 'cobros')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-subject">Asunto</Label>
            <Input
              id="claim-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej. Cobro duplicado de la cuota 4"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-body">Hechos</Label>
            <Textarea
              id="claim-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contá qué pasó, fechas e importes. No pegues claves ni datos de tarjeta."
              required
              minLength={20}
              rows={6}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Presentar reclamo
          </Button>
        </form>
      </SectionCard>
    </div>
  )
}
