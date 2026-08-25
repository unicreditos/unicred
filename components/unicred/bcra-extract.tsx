'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  formatPeriodoBcra,
  SITUACION_BCRA,
  type BcraDeudaEntidad,
  type BcraPeriodoResumen,
  type FullBcraSnapshot,
} from '@/lib/bcra'
import { formatARS, formatDateArg } from '@/lib/finance'

function sitLabel(n?: number | null) {
  if (!n) return '—'
  return `${n} · ${SITUACION_BCRA[n] ?? 'Informada'}`
}

function sitTone(n?: number | null) {
  if (!n) return 'outline' as const
  if (n <= 1) return 'default' as const
  if (n === 2) return 'secondary' as const
  return 'destructive' as const
}

function Flags({ e }: { e: BcraDeudaEntidad }) {
  const bits: string[] = []
  if (e.refinanciaciones) bits.push('Refinanciado')
  if (e.recategorizacionOblig) bits.push('Recategorizado')
  if (e.situacionJuridica) bits.push('Sit. jurídica')
  if (e.irrecDisposicionTecnica) bits.push('Irrec. disp. técnica')
  if (e.enRevision) bits.push('En revisión')
  if (e.procesoJud) bits.push('En juicio')
  if (!bits.length) return <span className="text-slate-400">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {bits.map((b) => (
        <Badge key={b} variant="outline" className="text-[10px] font-normal">
          {b}
        </Badge>
      ))}
    </span>
  )
}

function EntidadesTable({ rows }: { rows: BcraDeudaEntidad[] }) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Sin entidades en este informe.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entidad</TableHead>
          <TableHead>Situación</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead className="text-right">Atraso</TableHead>
          <TableHead>Sit. 1 desde</TableHead>
          <TableHead>Observaciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e, i) => (
          <TableRow key={`${e.entidad}-${i}`}>
            <TableCell className="max-w-[220px] text-sm">{e.entidad}</TableCell>
            <TableCell>
              <Badge variant={sitTone(e.situacion)}>{sitLabel(e.situacion)}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{formatARS(e.monto)}</TableCell>
            <TableCell className="text-right font-mono text-xs">{e.diasAtrasoPago ?? 0} d</TableCell>
            <TableCell className="text-xs text-slate-500">{e.fechaSit1 ? formatDateArg(e.fechaSit1) : '—'}</TableCell>
            <TableCell><Flags e={e} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PeriodosTable({ rows }: { rows: BcraPeriodoResumen[] }) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Sin informes históricos.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Período</TableHead>
          <TableHead>Peor situación</TableHead>
          <TableHead className="text-right">Entidades</TableHead>
          <TableHead className="text-right">Deuda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.periodo}>
            <TableCell className="font-mono text-xs">{formatPeriodoBcra(p.periodo)}</TableCell>
            <TableCell>
              <Badge variant={sitTone(p.worstSituation)}>{sitLabel(p.worstSituation)}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{p.entidades.length}</TableCell>
            <TableCell className="text-right font-mono text-xs">{formatARS(p.totalDebt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function BcraExtract({
  snapshot,
  variant = 'dashboard',
}: {
  snapshot: FullBcraSnapshot
  variant?: 'dashboard' | 'document'
}) {
  const titular = snapshot.deudas.denominacion || snapshot.historicas.denominacion || snapshot.chequesRechazados.denominacion
  const vigentes = snapshot.deudas.entidades ?? []
  const historicos = snapshot.historicas.periodos ?? []
  const cheques = snapshot.chequesRechazados.cheques ?? []
  const isDoc = variant === 'document'

  return (
    <div className={isDoc ? 'space-y-3 text-[12px]' : 'space-y-4'}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Último informe vigente
            {snapshot.deudas.periodo ? ` · ${formatPeriodoBcra(snapshot.deudas.periodo)}` : ''}
          </CardTitle>
          {titular ? <p className="text-sm text-slate-500">{titular}</p> : null}
        </CardHeader>
        <CardContent className="p-0">
          <EntidadesTable rows={vigentes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informes históricos ({historicos.length} períodos)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PeriodosTable rows={historicos} />
        </CardContent>
      </Card>

      {historicos.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Créditos por período histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Situación</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicos.flatMap((p) =>
                  p.entidades.map((e, i) => (
                    <TableRow key={`${p.periodo}-${e.entidad}-${i}`}>
                      <TableCell className="font-mono text-xs">{formatPeriodoBcra(p.periodo)}</TableCell>
                      <TableCell className="max-w-[220px] text-sm">{e.entidad}</TableCell>
                      <TableCell>
                        <Badge variant={sitTone(e.situacion)}>{sitLabel(e.situacion)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatARS(e.monto)}</TableCell>
                      <TableCell><Flags e={e} /></TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cheques rechazados ({cheques.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!cheques.length ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Sin cheques rechazados informados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cheque</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Causal</TableHead>
                  <TableHead>Rechazo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((c, i) => (
                  <TableRow key={`${c.nroCheque}-${i}`}>
                    <TableCell className="font-mono text-xs">{c.nroCheque ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] text-sm">{c.entidad ?? '—'}</TableCell>
                    <TableCell className="text-xs">{c.causal ?? '—'}</TableCell>
                    <TableCell className="text-xs">{c.fechaRechazo ? formatDateArg(c.fechaRechazo) : '—'}</TableCell>
                    <TableCell className="text-xs">{c.fechaPago ? formatDateArg(c.fechaPago) : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{c.monto != null ? formatARS(c.monto) : '—'}</TableCell>
                    <TableCell className="text-xs">
                      {c.procesoJud ? 'En juicio' : c.enRevision ? 'En revisión' : 'Informado'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
