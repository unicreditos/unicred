'use client'

import { updateBcraVariable, resetBcraVariableToLive } from '@/app/actions/admin'
import { syncBcraVariablesFromApi } from '@/app/actions/bcra'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Edit3, Loader2, RefreshCcw, Save, TrendingDown, TrendingUp, Minus, Database, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type VariableBCRACompat = {
  // Formato antiguo (compat)
  idVariable?: number | string
  descripcion?: string
  // Formato nuevo desde server action
  id?: string | number
  variable?: string
  // Campos comunes
  fecha?: string | null
  valor?: number | string | null
  // Metadatos overrides manual
  manualOverride?: boolean
  overrideNote?: string | null
  updatedBy?: string | null
  updatedAt?: string | Date | null
  rawPayload?: any
}

function formatNumberAR(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const num = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(num)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 4,
  }).format(num)
}

function formatDate(v: string | Date | null | undefined) {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isPercent(desc: string, v: number | string | null | undefined) {
  if (!desc) return false
  const d = desc.toLowerCase()
  const vn = typeof v === 'string' ? parseFloat(v) : (v ?? 0)
  return (
    d.includes('tasa') ||
    d.includes('t.n.a') ||
    d.includes('tna') ||
    d.includes('porcentaje') ||
    d.includes('%') ||
    d.includes('inflacion') ||
    d.includes('inflación') ||
    (typeof vn === 'number' && !isNaN(vn) && vn >= 0 && vn <= 250)
  )
}

function TrendIcon({ value }: { value: number | string | null | undefined }) {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  const num = isNaN(v) ? 0 : v
  if (num === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (num > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
  return <TrendingDown className="h-3.5 w-3.5 text-destructive" />
}

function shortUserId(s: string | null | undefined) {
  if (!s) return null
  if (s.length <= 10) return s
  return s.slice(0, 4) + '…' + s.slice(-4)
}

function normalizeVar(v: VariableBCRACompat): {
  id: string
  descripcion: string
  fecha: string | null
  valor: number | string | null
  manualOverride: boolean
  overrideNote: string | null
  updatedBy: string | null
  updatedAt: string | Date | null
} {
  const id = String(v.idVariable ?? v.id ?? '')
  const descripcion = v.variable ?? v.descripcion ?? `Variable #${id}`
  return {
    id,
    descripcion,
    fecha: v.fecha ?? null,
    valor: v.valor ?? null,
    manualOverride: !!v.manualOverride,
    overrideNote: v.overrideNote ?? null,
    updatedBy: v.updatedBy ?? null,
    updatedAt: v.updatedAt ?? null,
  }
}

export function BcraVariablesGrid({ variables }: { variables: VariableBCRACompat[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    variableName: string
    value: string
    effectiveDate: string
    overrideNote: string
  }>({ variableName: '', value: '', effectiveDate: '', overrideNote: '' })

  const handleSync = () => {
    startTransition(async () => {
      try {
        const r = await syncBcraVariablesFromApi()
        if (r.ok) {
          toast.success(`Sincronizadas ${r.synced} variables del BCRA`)
          router.refresh()
        } else {
          toast.error(r.error)
        }
      } catch (err: any) {
        toast.error(err?.message ?? 'No se pudo sincronizar con el BCRA')
      }
    })
  }

  if (!variables || !variables.length) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" disabled={isPending} onClick={() => handleSync()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Sincronizar API BCRA
          </Button>
        </div>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No se pudieron cargar las variables del BCRA. La API puede estar temporalmente no disponible.
        </div>
      </div>
    )
  }

  const openEdit = (raw: VariableBCRACompat) => {
    const v = normalizeVar(raw)
    setEditingId(v.id)
    const fechaDefault = v.fecha
      ? new Date(v.fecha)
      : new Date()
    const effectiveDate = !isNaN(fechaDefault.getTime())
      ? fechaDefault.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    setEditForm({
      variableName: v.descripcion,
      value: v.valor !== null && v.valor !== undefined ? String(v.valor) : '',
      effectiveDate,
      overrideNote: v.overrideNote ?? '',
    })
  }

  const handleSave = () => {
    if (!editingId) return
    if (!editForm.value.trim()) { toast.error('Valor numérico obligatorio'); return }
    startTransition(async () => {
      try {
        const r = await updateBcraVariable(editingId, {
          variableName: editForm.variableName.trim() || undefined,
          value: editForm.value.replace(',', '.'),
          effectiveDate: editForm.effectiveDate || undefined,
          overrideNote: editForm.overrideNote.trim() || undefined,
        })
        if (r.ok) {
          toast.success(`Variable #${editingId} · Override manual guardado`)
          setEditingId(null)
          router.refresh()
        }
      } catch (err: any) {
        toast.error(err?.message ?? 'Error al guardar variable BCRA')
      }
    })
  }

  const handleReset = (id: string, descripcion: string) => {
    const ok = window.confirm(`¿Volver la variable "${descripcion}" (#${id}) al valor live de la API BCRA? Se perderá el override manual.`)
    if (!ok) return
    startTransition(async () => {
      try {
        const r = await resetBcraVariableToLive(id)
        if (r.ok) {
          toast.success(`Variable #${id} · Restaurada al valor live`)
          router.refresh()
        }
      } catch (err: any) {
        toast.error(err?.message ?? 'Error al resetear variable')
      }
    })
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isPending} onClick={handleSync}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Sincronizar API BCRA
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {variables.map((raw) => {
          const v = normalizeVar(raw)
          const isPct = isPercent(v.descripcion, v.valor)
          const displayVal = isPct
            ? `${formatNumberAR(v.valor)}%`
            : formatNumberAR(v.valor)
          return (
            <Card
              key={v.id}
              className={cn(
                'overflow-hidden transition-all',
                v.manualOverride && 'ring-2 ring-amber-400/40 bg-amber-50/20 dark:bg-amber-950/10',
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {v.descripcion}
                  </CardTitle>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      #{v.id}
                    </span>
                    {v.manualOverride && (
                      <Badge variant="outline" className="h-4 gap-0.5 px-1.5 text-[9px] border-amber-300 bg-amber-500/10 text-amber-700">
                        <Database className="h-2.5 w-2.5" /> Override
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold tracking-tight tabular-nums truncate" title={String(v.valor)}>
                    {displayVal}
                  </span>
                  <TrendIcon value={v.valor} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDate(v.fecha)}
                </div>

                {(v.manualOverride || v.updatedAt || v.updatedBy) && (
                  <div className="rounded-md bg-muted/50 border border-border/50 p-1.5 space-y-0.5 text-[10px]">
                    {v.overrideNote && (
                      <div className="line-clamp-2 text-muted-foreground">
                        <span className="font-medium text-amber-700 dark:text-amber-400">Nota: </span>
                        {v.overrideNote}
                      </div>
                    )}
                    {(v.updatedBy || v.updatedAt) && (
                      <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                        Editado
                        {v.updatedBy && <> por <span className="font-mono">{shortUserId(v.updatedBy)}</span></>}
                        {v.updatedAt && <> · {formatDate(v.updatedAt)}</>}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7 text-[11px] px-2 flex-1"
                    disabled={isPending && editingId === v.id}
                    onClick={() => openEdit(raw)}
                  >
                    <Edit3 className="h-3 w-3" /> Editar
                  </Button>
                  {v.manualOverride && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 h-7 text-[11px] px-2 text-muted-foreground hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      disabled={isPending}
                      onClick={() => handleReset(v.id, v.descripcion)}
                    >
                      <RefreshCcw className="h-3 w-3" /> Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* DIALOG EDITAR VARIABLE BCRA */}
      <Dialog
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" /> Editar variable BCRA #{editingId ?? ''}
            </DialogTitle>
            <DialogDescription>
              Override manual. El valor editado queda almacenado en la base de datos y será usado por el motor de scoring interno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Descripción / Nombre</Label>
              <Input
                value={editForm.variableName}
                onChange={(e) => setEditForm({ ...editForm, variableName: e.target.value })}
                placeholder="Ej: Tasa de Política Monetaria (TPM)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor numérico</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  placeholder="Ej: 80.50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha efectiva</Label>
                <Input
                  type="date"
                  value={editForm.effectiveDate}
                  onChange={(e) => setEditForm({ ...editForm, effectiveDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota / Motivo override (opcional)</Label>
              <Textarea
                rows={3}
                value={editForm.overrideNote}
                onChange={(e) => setEditForm({ ...editForm, overrideNote: e.target.value })}
                placeholder="Ej: Ajuste estacional de diciembre / dato de EPH no publicado todavía / reunión COPOM anticipada..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isPending || !editForm.value.trim()}
              className="gap-1"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
