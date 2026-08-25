'use client'

import { consultBcraByCuil } from '@/app/actions/bcra'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatARS } from '@/lib/finance'
import { BcraExtract } from '@/components/unicred/bcra-extract'
import { Database, Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const SITUACION: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Riesgo medio',
  4: 'Riesgo alto',
  5: 'Irrecuperable',
}

export function BcraCuitLookup() {
  const router = useRouter()
  const [cuil, setCuil] = useState('')
  const [pending, start] = useTransition()
  const [result, setResult] = useState<Awaited<ReturnType<typeof consultBcraByCuil>> | null>(null)

  const run = () => {
    start(async () => {
      try {
        const r = await consultBcraByCuil(cuil)
        setResult(r)
        if (!r.ok) toast.error(r.error)
        else {
          toast.success(r.persisted ? 'Consulta BCRA guardada en el perfil del cliente' : 'Consulta BCRA en vivo')
          router.refresh()
        }
      } catch (e: any) {
        toast.error(e?.message ?? 'No se pudo consultar el BCRA')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" /> Consulta Central de Deudores
        </CardTitle>
        <CardDescription>
          API pública del BCRA: deudas vigentes, históricas y cheques rechazados. Si el CUIT existe en UNICRÉDITOS, se persiste el informe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="bcra-cuit">CUIT / CUIL</Label>
            <Input
              id="bcra-cuit"
              inputMode="numeric"
              placeholder="20-12345678-9"
              value={cuil}
              onChange={(e) => setCuil(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run()
              }}
            />
          </div>
          <Button onClick={run} disabled={pending || cuil.replace(/\D/g, '').length < 11} className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Consultar BCRA
          </Button>
        </div>

        {result && result.ok ? (
          <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Denominación</p>
              <p className="mt-1 text-sm font-semibold">{result.snapshot.denominacion ?? 'Sin datos en Central'}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Score UNICRÉDITOS</p>
              <p className="mt-1 font-mono text-2xl font-bold">{result.score.score}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{result.score.band}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Peor situación</p>
              <p className="mt-1 text-sm font-semibold">
                {result.snapshot.worstSituation
                  ? `${result.snapshot.worstSituation} · ${SITUACION[result.snapshot.worstSituation] ?? ''}`
                  : 'Sin informar'}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Deuda reportada</p>
              <p className="mt-1 font-mono text-sm font-bold">{formatARS(result.snapshot.totalDebt)}</p>
              <p className="text-[11px] text-muted-foreground">{result.snapshot.entitiesCount} entidades</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Cheques rechazados: {result.snapshot.chequesRechazados}</Badge>
                {result.snapshot.historicaWorst ? (
                  <Badge variant="outline">Histórica sit. {result.snapshot.historicaWorst}</Badge>
                ) : null}
                {result.persisted ? <Badge>Persistido en perfil</Badge> : <Badge variant="secondary">CUIT no vinculado a un cliente</Badge>}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {result.score.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </div>
          </div>
            {result.snapshot.full ? <BcraExtract snapshot={result.snapshot.full} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
