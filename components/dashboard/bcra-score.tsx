'use client'

import { consultMyBcra } from '@/app/actions/bcra'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BcraExtract } from '@/components/unicred/bcra-extract'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { formatARS, formatDateTimeArg } from '@/lib/finance'
import {
  formatPeriodoBcra,
  SITUACION_BCRA,
  type FullBcraSnapshot,
} from '@/lib/bcra'
import { bcraCheck, profile } from '@/lib/db/schema'
import { Loader2, RefreshCw, Scale } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Profile = typeof profile.$inferSelect
type BcraCheck = typeof bcraCheck.$inferSelect

interface BCRAScoreProps {
  profile: Profile | null
  lastBcraCheck: BcraCheck | null
  autoConsult?: boolean
}

const BAND_CONFIG = {
  excelente: { label: 'Excelente', min: 720, max: 850, description: 'Perfil sólido. Acceso a las mejores tasas y montos de la línea.', tone: 'ok' as const },
  bueno: { label: 'Bueno', min: 640, max: 719, description: 'Perfil bueno. Podés acceder a créditos con tasas competitivas.', tone: 'ok' as const },
  regular: { label: 'Regular', min: 560, max: 639, description: 'Perfil regular. El monto y la tasa se evalúan con más restricción.', tone: 'warn' as const },
  bajo: { label: 'Bajo', min: 300, max: 559, description: 'Score bajo. Hace falta regularizar el historial para acceder a crédito.', tone: 'critical' as const },
} as const

type Band = keyof typeof BAND_CONFIG

function getBand(score: number | null | undefined): Band | null {
  if (score === null || score === undefined) return null
  if (score >= 720) return 'excelente'
  if (score >= 640) return 'bueno'
  if (score >= 560) return 'regular'
  return 'bajo'
}

function snapshotFromCheck(check: BcraCheck | null): FullBcraSnapshot | null {
  if (!check) return null
  const raw = (check.rawResult ?? check.rawResponse) as any
  if (!raw || typeof raw !== 'object') return null
  if (!raw.deudas && !raw.historicas && !raw.chequesRechazados) return null
  return {
    cuil: check.cuil,
    consultedAt: String(raw.consultedAt ?? check.consultedAt ?? ''),
    deudas: {
      found: Boolean(raw.deudas?.found ?? check.entitiesCount),
      denominacion: raw.deudas?.denominacion ?? raw.denominacion ?? null,
      identificacion: raw.deudas?.identificacion,
      periodo: raw.deudas?.periodo ?? null,
      periodos: raw.deudas?.periodos ?? [],
      worstSituation: raw.deudas?.worstSituation ?? check.worstSituation,
      totalDebt: Number(raw.deudas?.totalDebt ?? check.totalDebt ?? 0),
      entitiesCount: raw.deudas?.entitiesCount ?? check.entitiesCount ?? 0,
      entidades: raw.deudas?.entidades ?? [],
    },
    historicas: raw.historicas ?? {
      found: false,
      denominacion: null,
      periodos: [],
      worstSituation: null,
      totalDebt: 0,
      entitiesCount: 0,
      entidades: [],
    },
    chequesRechazados: raw.chequesRechazados ?? { found: false, unavailable: false, count: 0, cheques: [] },
    unavailable: false,
  }
}

export function BCRAScore({ profile, lastBcraCheck, autoConsult = false }: BCRAScoreProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [live, setLive] = useState<FullBcraSnapshot | null>(null)
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [liveReasons, setLiveReasons] = useState<string[]>([])
  const autoRan = useRef(false)
  const fromCheck = useMemo(() => snapshotFromCheck(lastBcraCheck), [lastBcraCheck])
  const snap = live ?? fromCheck
  const score = liveScore ?? profile?.creditScore ?? lastBcraCheck?.computedScore ?? null
  const isSynthetic = String(lastBcraCheck?.source ?? '').includes('synth') || String(lastBcraCheck?.source ?? '').includes('fallback')
  const band = getBand(score)
  const cfg = band ? BAND_CONFIG[band] : null
  const worst = snap?.deudas.worstSituation ?? lastBcraCheck?.worstSituation ?? null
  const situacion = worst ? `${worst} · ${SITUACION_BCRA[worst] ?? ''}` : 'Sin consulta'
  const persistedReasons = liveReasons.length
    ? liveReasons
    : (((lastBcraCheck?.rawResult as any)?.score?.reasons ?? []) as string[])
  const titular = snap?.deudas.denominacion || snap?.historicas.denominacion

  const consult = () => {
    start(async () => {
      const r = await consultMyBcra()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setLive(r.snapshot)
      setLiveScore(r.score.score)
      setLiveReasons(r.score.reasons ?? [])
      toast.success('Central de Deudores extraída: deudas, históricas y cheques')
      router.refresh()
    })
  }

  useEffect(() => {
    if (!autoConsult || autoRan.current || pending) return
    if (!profile?.cuil) return
    const src = String(lastBcraCheck?.source ?? '')
    const needs =
      !lastBcraCheck || src.includes('synth') || src.includes('fallback')
    if (!needs) return
    autoRan.current = true
    consult()
  }, [autoConsult, lastBcraCheck, pending, profile?.cuil])

  const consultBtn = (
    <Button size="sm" onClick={consult} disabled={pending || !profile?.cuil} className="gap-1.5 shrink-0">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Consultar BCRA
    </Button>
  )

  return (
    <div className="space-y-5">
      <DecisionBanner
        tone={!profile?.cuil ? 'warn' : !score ? 'info' : cfg?.tone ?? 'info'}
        title={!profile?.cuil ? 'Falta el CUIL para consultar el BCRA' : !score ? 'Sin score todavía' : `Score UNICRÉDITOS ${score} · ${cfg?.label}`}
        detail={
          !profile?.cuil
            ? 'Completalo en Identidad. La Central de Deudores se consulta con CUIL/CUIT de 11 dígitos.'
            : !score
              ? 'Se extraen deudas vigentes, informes históricos y cheques rechazados de las APIs oficiales del BCRA.'
              : [titular, cfg?.description].filter(Boolean).join(' · ')
        }
        action={consultBtn}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Score UNICRÉDITOS"
          value={score ?? '—'}
          hint={cfg ? `${cfg.min}–${cfg.max} · ${cfg.label}` : '300 a 850 · sin consulta'}
          tone={!score ? 'warn' : cfg?.tone === 'ok' ? 'ok' : cfg?.tone === 'critical' ? 'critical' : 'warn'}
        />
        <MetricTile
          label="Situación BCRA"
          value={situacion}
          hint={snap?.deudas.periodo ? `Último informe ${formatPeriodoBcra(snap.deudas.periodo)}` : 'Central de Deudores'}
          tone={!snap && !lastBcraCheck ? 'warn' : (worst ?? 0) >= 3 ? 'critical' : worst ? 'ok' : 'warn'}
        />
        <MetricTile
          label="Deuda vigente"
          value={formatARS(snap?.deudas.totalDebt ?? lastBcraCheck?.totalDebt ?? 0)}
          hint={titular || 'Informada por entidades al BCRA'}
        />
        <MetricTile
          label="Cheques rechazados"
          value={String(snap?.chequesRechazados.count ?? (lastBcraCheck?.hasRejectedChecks ? 'Sí' : 0))}
          hint={`${snap?.deudas.entitiesCount ?? lastBcraCheck?.entitiesCount ?? 0} entidades vigentes`}
          tone={(snap?.chequesRechazados.count ?? 0) > 0 || lastBcraCheck?.hasRejectedChecks ? 'critical' : 'default'}
        />
      </div>

      {isSynthetic && !live ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El dato guardado no es una consulta real. Volvé a consultar el BCRA para extraer el informe completo.
        </p>
      ) : null}

      {snap ? (
        <BcraExtract snapshot={snap} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay extracto. Consultá el BCRA para ver situación de créditos, último informe, históricas y cheques.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Factores del score</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          {persistedReasons.length ? (
            persistedReasons.map((r) => (
              <p key={r} className="rounded-lg border border-border bg-muted px-3 py-2">{r}</p>
            ))
          ) : (
            <p className="text-muted-foreground">
              {score
                ? 'La consulta está guardada. Los factores se listan cuando el extracto incluye el detalle del score.'
                : 'Aparecen después de consultar la Central de Deudores.'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            CUIL {lastBcraCheck?.cuil ?? profile?.cuil ?? '—'}
            {' · '}
            Fuente: {lastBcraCheck?.source === 'bcra_api' ? 'API BCRA' : lastBcraCheck?.source ?? 'sin consulta'}
            {' · '}
            {formatDateTimeArg(snap?.consultedAt ?? lastBcraCheck?.consultedAt ?? lastBcraCheck?.createdAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
