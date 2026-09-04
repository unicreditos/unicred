'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createRiskRuleVersion } from '@/app/actions/risk-rules'
import { formatARS } from '@/lib/finance'

type RiskRuleParams = {
  scoreRejectBelow: number
  scoreAutoQualifyAt: number
  incomeDtiRatio: number
  firstCreditHardCap: number
  bcraWorstSituationRejectAt: number
  bcraRejectedChecksSituationThreshold: number
}

type RiskRuleVersionRow = {
  id: string
  version: number
  isActive: boolean
  params: RiskRuleParams
  notes: string | null
  createdByEmail: string | null
  createdAt: string | Date
}

function fmtDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function RiskRulesDesk({ versions, canWrite }: { versions: RiskRuleVersionRow[]; canWrite: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const active = versions.find((v) => v.isActive) ?? versions[0]
  const [form, setForm] = useState<RiskRuleParams & { notes: string }>(() => ({
    scoreRejectBelow: active?.params.scoreRejectBelow ?? 560,
    scoreAutoQualifyAt: active?.params.scoreAutoQualifyAt ?? 640,
    incomeDtiRatio: active?.params.incomeDtiRatio ?? 0.35,
    firstCreditHardCap: active?.params.firstCreditHardCap ?? 400000,
    bcraWorstSituationRejectAt: active?.params.bcraWorstSituationRejectAt ?? 4,
    bcraRejectedChecksSituationThreshold: active?.params.bcraRejectedChecksSituationThreshold ?? 3,
    notes: '',
  }))

  function openEdit() {
    if (!active) return
    setForm({ ...active.params, notes: '' })
    setEditing(true)
  }

  function submit() {
    startTransition(async () => {
      try {
        const r = await createRiskRuleVersion(form)
        toast.success(`Reglas de riesgo v${r.version} activadas`)
        setEditing(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
      }
    })
  }

  if (!active) return null

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[13px] font-semibold text-brand-navy-900">Reglas de underwriting</h2>
          <p className="text-[11px] text-muted-foreground">Parámetros configurables, versionados. No son un criterio financiero fijo.</p>
        </div>
        {canWrite && !editing ? (
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={openEdit}>
            Nueva versión
          </Button>
        ) : null}
      </header>

      {editing ? (
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[11px]">Score mínimo (rechazo)</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={form.scoreRejectBelow}
                onChange={(e) => setForm({ ...form, scoreRejectBelow: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Score calificación automática</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={form.scoreAutoQualifyAt}
                onChange={(e) => setForm({ ...form, scoreAutoQualifyAt: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Tope cuota / ingresos (%)</Label>
              <Input
                type="number"
                step="1"
                className="h-8 text-xs"
                value={Math.round(form.incomeDtiRatio * 100)}
                onChange={(e) => setForm({ ...form, incomeDtiRatio: Number(e.target.value) / 100 })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Techo primer crédito ($)</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={form.firstCreditHardCap}
                onChange={(e) => setForm({ ...form, firstCreditHardCap: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Situación BCRA de rechazo (1-6)</Label>
              <Input
                type="number"
                min={1}
                max={6}
                className="h-8 text-xs"
                value={form.bcraWorstSituationRejectAt}
                onChange={(e) => setForm({ ...form, bcraWorstSituationRejectAt: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Umbral cheques rechazados (1-6)</Label>
              <Input
                type="number"
                min={1}
                max={6}
                className="h-8 text-xs"
                value={form.bcraRejectedChecksSituationThreshold}
                onChange={(e) => setForm({ ...form, bcraRejectedChecksSituationThreshold: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Motivo del cambio (queda en el historial)</Label>
            <Input
              className="h-8 text-xs"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: bajamos el score mínimo tras revisar la mora del trimestre"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8" onClick={submit} disabled={isPending}>
              Activar nueva versión
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Score mín." value={String(active.params.scoreRejectBelow)} />
          <Metric label="Score auto" value={String(active.params.scoreAutoQualifyAt)} />
          <Metric label="Tope cuota/ingr." value={`${Math.round(active.params.incomeDtiRatio * 100)}%`} />
          <Metric label="Techo 1er crédito" value={formatARS(active.params.firstCreditHardCap)} />
          <Metric label="Situación BCRA rechazo" value={String(active.params.bcraWorstSituationRejectAt)} />
          <Metric label="Umbral cheques" value={String(active.params.bcraRejectedChecksSituationThreshold)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto border-t border-border">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-1.5">Versión</th>
              <th className="px-4 py-1.5">Motivo</th>
              <th className="px-4 py-1.5">Por</th>
              <th className="px-4 py-1.5">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-1.5 font-mono">
                  v{v.version} {v.isActive ? <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">activa</span> : null}
                </td>
                <td className="px-4 py-1.5">{v.notes || '—'}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{v.createdByEmail || 'sistema'}</td>
                <td className="px-4 py-1.5 font-mono text-muted-foreground">{fmtDate(v.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[14px] font-semibold tabular-nums text-brand-navy-900">{value}</p>
    </div>
  )
}
