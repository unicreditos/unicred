'use client'

import { createArcaSalesPointVersion, getArcaSalesPointConfig } from '@/app/actions/arca-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type ConfigData = Awaited<ReturnType<typeof getArcaSalesPointConfig>>

function fmtDate(v: string) {
  const d = new Date(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function ArcaConfigDesk() {
  const [data, setData] = useState<ConfigData | null>(null)
  const [editing, setEditing] = useState(false)
  const [ptoVta, setPtoVta] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, start] = useTransition()

  function load() {
    start(async () => {
      setData(await getArcaSalesPointConfig())
    })
  }

  useEffect(() => {
    load()
  }, [])

  const active = data?.versions.find((v) => v.isActive) ?? null

  function openEdit() {
    setPtoVta(active ? String(active.ptoVta) : '')
    setNotes('')
    setEditing(true)
  }

  function submit() {
    const n = Number(ptoVta)
    start(async () => {
      try {
        const r = await createArcaSalesPointVersion({ ptoVta: n, notes })
        toast.success(`Punto de venta ${r.ptoVta} activado (v${r.version})`)
        setEditing(false)
        load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
      }
    })
  }

  if (!data) return null

  return (
    <SectionCard
      title="Facturación ARCA · Punto de venta"
      description="Configurá acá el punto de venta WsFE antes de poder emitir facturas de intereses."
      bodyClassName=""
      action={
        data.canWrite && !editing ? (
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={openEdit}>
            {active ? 'Nueva versión' : 'Configurar'}
          </Button>
        ) : null
      }
    >
      {!active && !editing ? (
        <div className="px-4 py-4">
          <p className="rounded-lg border border-brand-amber/30 bg-brand-amber/10 px-3 py-2.5 text-xs text-brand-amber">
            Todavía no hay punto de venta configurado. Ninguna factura de intereses se puede emitir hasta que
            lo cargue un admin con permiso de configuración.
          </p>
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-3 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">Punto de venta (WsFE)</Label>
              <Input
                type="number"
                min={1}
                className="h-8 text-xs"
                value={ptoVta}
                onChange={(e) => setPtoVta(e.target.value)}
                placeholder="Ej: 3"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Motivo del cambio (queda en el historial)</Label>
            <Input
              className="h-8 text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: punto de venta habilitado en AFIP para facturación electrónica"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8" onClick={submit} disabled={pending || !ptoVta.trim() || !notes.trim()}>
              Activar
            </Button>
          </div>
        </div>
      ) : active ? (
        <div className="px-4 py-3">
          <div className="inline-flex flex-col rounded-lg border border-border px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Punto de venta vigente</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{active.ptoVta}</span>
          </div>
        </div>
      ) : null}

      {data.versions.length > 0 ? (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-1.5">Versión</th>
                <th className="px-4 py-1.5">Pto. Vta.</th>
                <th className="px-4 py-1.5">Motivo</th>
                <th className="px-4 py-1.5">Por</th>
                <th className="px-4 py-1.5">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.versions.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-1.5 font-mono">
                    v{v.version}{' '}
                    {v.isActive ? (
                      <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">activa</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-1.5 font-mono tabular-nums">{v.ptoVta}</td>
                  <td className="px-4 py-1.5">{v.notes || '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{v.createdByEmail || 'sistema'}</td>
                  <td className="px-4 py-1.5 font-mono text-muted-foreground">{fmtDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  )
}
