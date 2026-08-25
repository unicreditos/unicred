'use client'

import { createClaim, listMyClaims } from '@/app/actions/claims'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { supportCase } from '@/lib/db/schema'
import { Scale, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

type Claim = typeof supportCase.$inferSelect

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'cobros', label: 'Cobros y cuotas' },
  { id: 'identidad', label: 'Identidad / Didit' },
  { id: 'desembolso', label: 'Desembolso' },
  { id: 'contrato', label: 'Contrato o pagaré' },
  { id: 'otro', label: 'Otro' },
]

const STATUS: Record<string, string> = {
  open: 'Abierto',
  in_review: 'En revisión',
  resolved: 'Respondido',
  closed: 'Cerrado',
}

export function ClaimsPanel() {
  const [rows, setRows] = useState<Claim[]>([])
  const [category, setCategory] = useState('cobros')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = () => {
    listMyClaims()
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <SectionCard
        title="Presentar un reclamo"
        description="Ley 24.240 de Defensa del Consumidor. Plazo máximo de respuesta: 10 días hábiles."
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
                setOk(`Reclamo ${r.id.slice(0, 12)} registrado. Te llega un mail de confirmación.`)
                refresh()
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
            Enviar reclamo
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Expedientes"
        description={`${rows.length} reclamo${rows.length === 1 ? '' : 's'} en tu cuenta.`}
        icon={<Scale className="h-4 w-4 text-brand-primary" />}
        className="lg:col-span-7"
      >
        {!rows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Todavía no presentaste reclamos.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{row.subject}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.id}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">
                    {STATUS[row.status] ?? row.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.body}</p>
                {row.response ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    <span className="font-semibold">Respuesta: </span>
                    {row.response}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-slate-400">
                  {new Date(row.createdAt).toLocaleString('es-AR')} · {row.lawRef}
                </p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
