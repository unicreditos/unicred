'use client'

import {
  consultChequeDenunciado,
  listBcraCotizaciones,
  listBcraCotizacionesMoneda,
  listBcraDivisas,
  listChequesEntidades,
  listInformeMonetarioDiario,
  listMetodologiaMonetaria,
  listTransparencia,
  listVariableMonetariaSerie,
} from '@/app/actions/bcra'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TRANSPARENCIA_PRODUCTOS, type TransparenciaProductoId } from '@/lib/bcra'
import { Loader2, Search } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

function fmtNum(v: number | string | null | undefined) {
  if (v == null || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(n)
}

function JsonPreview({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">Sin resultados para esta consulta.</p>
  }
  const keys = Array.from(
    rows.slice(0, 8).reduce((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k))
      return acc
    }, new Set<string>()),
  ).slice(0, 8)
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {keys.map((k) => (
              <TableHead key={k} className="whitespace-nowrap text-xs">
                {k}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 40).map((row, i) => (
            <TableRow key={i}>
              {keys.map((k) => (
                <TableCell key={k} className="max-w-[220px] truncate text-xs">
                  {row[k] == null || typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function BcraCatalogPanel() {
  const [tab, setTab] = useState('cheques')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catálogo API BCRA</CardTitle>
        <CardDescription>
          Consultas en vivo de Cheques denunciados, Estadísticas cambiarias, Estadísticas monetarias v4.0
          (incluye Informe Monetario Diario) y Régimen de Transparencia.{' '}
          <a
            href="https://www.bcra.gob.ar/apis-banco-central/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Documentación oficial
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="cheques">Cheques</TabsTrigger>
            <TabsTrigger value="cambiarias">Cambiarias</TabsTrigger>
            <TabsTrigger value="monetarias">Monetarias v4</TabsTrigger>
            <TabsTrigger value="transparencia">Transparencia</TabsTrigger>
          </TabsList>
          {tab === 'cheques' ? <ChequesPanel /> : null}
          {tab === 'cambiarias' ? <CambiariasPanel /> : null}
          {tab === 'monetarias' ? <MonetariasPanel /> : null}
          {tab === 'transparencia' ? <TransparenciaPanel /> : null}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function ChequesPanel() {
  const [pending, start] = useTransition()
  const [codigo, setCodigo] = useState('11')
  const [numero, setNumero] = useState('')
  const [entidades, setEntidades] = useState<{ codigoEntidad: number; denominacion: string }[]>([])
  const [result, setResult] = useState<Awaited<ReturnType<typeof consultChequeDenunciado>> | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Código de entidad</Label>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="11" />
        </div>
        <div className="space-y-1.5">
          <Label>Número de cheque</Label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="12345678" />
        </div>
        <div className="flex items-end gap-2">
          <Button
            className="gap-1.5"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await consultChequeDenunciado(codigo, numero)
                setResult(r)
                if (!r.ok) toast.error(r.error)
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar denuncia
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listChequesEntidades()
                if (!r.ok) toast.error(r.error)
                else {
                  setEntidades(r.entidades)
                  toast.success(`${r.entidades.length} entidades`)
                }
              })
            }
          >
            Entidades
          </Button>
        </div>
      </div>

      {result?.ok ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.result.denunciado ? 'destructive' : 'secondary'}>
              {result.result.found
                ? result.result.denunciado
                  ? 'Denunciado'
                  : 'No denunciado'
                : 'Sin registro'}
            </Badge>
            {result.result.denominacionEntidad ? <span>{result.result.denominacionEntidad}</span> : null}
          </div>
          <p className="mt-2 text-muted-foreground">
            Cheque {result.result.numeroCheque ?? numero}
            {result.result.fechaProcesamiento ? ` · procesado ${result.result.fechaProcesamiento}` : ''}
          </p>
          {result.result.detalles.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {result.result.detalles.map((d, i) => (
                <li key={i}>
                  {d.causal ?? 'Sin causal'}
                  {d.sucursal != null ? ` · sucursal ${d.sucursal}` : ''}
                  {d.numeroCuenta != null ? ` · cuenta ${d.numeroCuenta}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {entidades.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Entidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entidades.slice(0, 80).map((e) => (
                <TableRow key={e.codigoEntidad}>
                  <TableCell className="font-mono text-xs">{e.codigoEntidad}</TableCell>
                  <TableCell className="text-sm">{e.denominacion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

function CambiariasPanel() {
  const [pending, start] = useTransition()
  const [fecha, setFecha] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [fx, setFx] = useState<{ moneda: string; descripcion?: string | null; tipoCotizacion: number | null; fecha: string | null }[]>([])
  const [divisas, setDivisas] = useState<{ codigo: string; denominacion: string }[]>([])
  const [serie, setSerie] = useState<{ moneda: string; tipoCotizacion: number | null; fecha: string | null }[]>([])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Fecha (opcional)</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Input value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase())} placeholder="USD" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listBcraCotizaciones(fecha || undefined)
                if (!r.ok) toast.error(r.error)
                else {
                  setFx(r.fx)
                  toast.success(`${r.fx.length} cotizaciones`)
                }
              })
            }
          >
            Cotizaciones
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listBcraDivisas()
                setDivisas(r.divisas)
                toast.success(`${r.divisas.length} divisas`)
              })
            }
          >
            Divisas
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listBcraCotizacionesMoneda(moneda)
                if (!r.ok) toast.error(r.error)
                else setSerie(r.serie)
              })
            }
          >
            Serie {moneda || 'USD'}
          </Button>
        </div>
      </div>

      {fx.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moneda</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cotización</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fx.map((c, i) => (
                <TableRow key={`${c.moneda}-${i}`}>
                  <TableCell className="font-mono text-xs">{c.moneda}</TableCell>
                  <TableCell className="text-xs">{c.descripcion ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNum(c.tipoCotizacion)}</TableCell>
                  <TableCell className="text-xs">{c.fecha ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {serie.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Cotización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serie.slice(0, 40).map((c, i) => (
                <TableRow key={`${c.fecha}-${i}`}>
                  <TableCell className="text-xs">{c.fecha ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{c.moneda}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNum(c.tipoCotizacion)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {divisas.length ? (
        <p className="text-xs text-muted-foreground">
          Maestro de divisas: {divisas.map((d) => d.codigo).join(', ')}
        </p>
      ) : null}
    </div>
  )
}

function MonetariasPanel() {
  const [pending, start] = useTransition()
  const [idVariable, setIdVariable] = useState('1')
  const [variables, setVariables] = useState<{ idVariable: number; descripcion: string; fecha: string; valor: number; categoria?: string | null }[]>([])
  const [serie, setSerie] = useState<{ fecha: string; valor: number }[]>([])
  const [metodologia, setMetodologia] = useState<{ id: number; detalle: string }[]>([])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>ID variable</Label>
          <Input className="w-28" value={idVariable} onChange={(e) => setIdVariable(e.target.value)} />
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listInformeMonetarioDiario()
              if (!r.ok) toast.error(r.error)
              else {
                setVariables(r.variables)
                toast.success(`${r.variables.length} series del Informe Monetario Diario`)
              }
            })
          }
        >
          Informe Monetario Diario
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listVariableMonetariaSerie(idVariable)
              if (!r.ok) toast.error(r.error)
              else setSerie(r.serie)
            })
          }
        >
          Serie histórica
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listMetodologiaMonetaria(idVariable)
              setMetodologia(r.items)
            })
          }
        >
          Metodología
        </Button>
      </div>

      {variables.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Variable</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Último valor</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.slice(0, 50).map((v) => (
                <TableRow key={v.idVariable}>
                  <TableCell className="font-mono text-xs">{v.idVariable}</TableCell>
                  <TableCell className="max-w-[280px] text-xs">{v.descripcion}</TableCell>
                  <TableCell className="text-xs">{v.categoria ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNum(v.valor)}</TableCell>
                  <TableCell className="text-xs">{v.fecha || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {serie.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serie.slice(0, 40).map((p, i) => (
                <TableRow key={`${p.fecha}-${i}`}>
                  <TableCell className="text-xs">{p.fecha}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNum(p.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {metodologia.length ? (
        <ul className="space-y-2 text-xs text-muted-foreground">
          {metodologia.slice(0, 8).map((m, i) => (
            <li key={`${m.id}-${i}`}>
              <span className="font-mono text-foreground">#{m.id}</span> {m.detalle}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TransparenciaPanel() {
  const [pending, start] = useTransition()
  const [producto, setProducto] = useState<TransparenciaProductoId>('personales')
  const [entidad, setEntidad] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [label, setLabel] = useState('')

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Producto</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={producto}
            onChange={(e) => setProducto(e.target.value as TransparenciaProductoId)}
          >
            {TRANSPARENCIA_PRODUCTOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Código entidad (opcional)</Label>
          <Input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="11" />
        </div>
        <div className="flex items-end">
          <Button
            className="gap-1.5"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listTransparencia(producto, entidad || undefined)
                if (!r.ok) {
                  toast.error(r.error)
                  setRows([])
                  return
                }
                setRows(r.result.results)
                setLabel(r.result.label)
                toast.success(`${r.result.count} registros de ${r.result.label}`)
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar
          </Button>
        </div>
      </div>
      {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      <JsonPreview rows={rows} />
    </div>
  )
}
