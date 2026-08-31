'use client'

import type { AdminOpsConfig } from '@/app/actions/admin-config'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'

export function AdminConfigDesk({ data }: { data: AdminOpsConfig | null }) {
  const okCount = data?.integrations.filter((i) => i.ok).length ?? 0
  const total = data?.integrations.length ?? 0

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile
          label="Integraciones"
          value={data ? `${okCount}/${total}` : '—'}
          tone={!data ? 'default' : okCount === total ? 'ok' : 'warn'}
          hint="Sin secretos: solo estado"
        />
        <MetricTile label="Rechazo auto" value={data ? String(data.motor.rejectBelow) : '—'} hint="Score BCRA / CENDEU" />
        <MetricTile label="Calificación auto" value={data ? String(data.motor.autoQualify) : '—'} hint="Sin cola manual" />
        <MetricTile label="Tope 1er crédito" value={data ? formatARS(data.motor.firstCap) : '—'} hint={`DTI ${data?.motor.dtiPct ?? 35}% · punitorios 0%`} />
      </div>

      {!data ? (
        <p className="shrink-0 text-sm text-destructive">No se pudo leer la configuración operativa.</p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white lg:col-span-7">
          <header className="shrink-0 border-b px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Estado operativo</h2>
            <p className="text-[10px] text-slate-500">No se muestran claves. Un fallo acá explica por qué un canal no acredita.</p>
          </header>
          <ul className="min-h-0 flex-1 overflow-auto divide-y">
            {(data?.integrations ?? []).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{row.label}</p>
                  <p className="text-[11px] text-slate-500">{row.hint}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    row.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800',
                  )}
                >
                  {row.ok ? 'Listo' : 'Falta'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white lg:col-span-5">
          <header className="shrink-0 border-b px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Motor de originación</h2>
            <p className="text-[10px] text-slate-500">Umbrales en código. Cambiarlos es un deploy, no una fila de reglas.</p>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[12px] text-slate-700">
            {data ? (
              <ul className="space-y-2">
                <li>Score &lt; {data.motor.rejectBelow}: rechazo automático.</li>
                <li>Score ≥ {data.motor.autoQualify}: calificación automática.</li>
                <li>Cuota máxima {data.motor.dtiPct}% del ingreso declarado.</li>
                <li>Primer crédito tope {formatARS(data.motor.firstCap)}.</li>
                <li>Punitorios {data.motor.punitorios}%.</li>
                <li>{data.motor.cftNote}.</li>
              </ul>
            ) : null}
            {data?.missingRequired.length ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] text-rose-900">
                <p className="font-semibold">Faltan variables requeridas</p>
                {data.missingRequired.map((c) => (
                  <p key={c.name}>
                    {c.name}: {c.detail}
                  </p>
                ))}
              </div>
            ) : null}
            {data?.missingOptional.length ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-800">Opcionales sin cargar</p>
                {data.missingOptional.map((c) => (
                  <p key={c.name}>
                    {c.name}: {c.detail}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </OpsFloor>
  )
}
