'use client'

import { updateLoanProductAdmin } from '@/app/actions/admin-cases'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { computeFrenchAmortization, formatARS } from '@/lib/finance'
import {
  FIRST_CREDIT_HARD_CAP,
  INCOME_DTI_RATIO,
  SCORE_AUTO_QUALIFY_AT,
  SCORE_REJECT_BELOW,
} from '@/lib/loan-underwriting'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type ProductRow = {
  id: string
  name: string
  type: string
  minAmount: string | number
  maxAmount: string | number
  minTerm: number
  maxTerm: number
  monthlyRate: string | number
  tna: string | number
  active: boolean
}

function formatPct(value: string | number | null | undefined) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function estimatedCft(monthlyRate: string | number | null | undefined) {
  const m = typeof monthlyRate === 'string' ? parseFloat(monthlyRate) : Number(monthlyRate)
  if (!Number.isFinite(m) || m <= 0) return null
  return computeFrenchAmortization(100_000, 12, m).cft
}

export function AdminProductsDesk({ products }: { products: ProductRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<ProductRow | null>(null)
  const [form, setSet] = useState({
    name: '',
    minAmount: '',
    maxAmount: '',
    minTerm: '',
    maxTerm: '',
    monthlyRate: '',
    tna: '',
  })

  const activos = products.filter((p) => p.active)
  const montoMin = activos.length ? Math.min(...activos.map((p) => Number(p.minAmount) || 0)) : 0
  const montoMax = activos.length ? Math.max(...activos.map((p) => Number(p.maxAmount) || 0)) : 0
  const plazoMin = activos.length ? Math.min(...activos.map((p) => p.minTerm || 0)) : 0
  const plazoMax = activos.length ? Math.max(...activos.map((p) => p.maxTerm || 0)) : 0

  function open(p: ProductRow) {
    setEdit(p)
    setSet({
      name: p.name,
      minAmount: String(p.minAmount),
      maxAmount: String(p.maxAmount),
      minTerm: String(p.minTerm),
      maxTerm: String(p.maxTerm),
      monthlyRate: String(p.monthlyRate),
      tna: String(p.tna),
    })
  }

  function save() {
    if (!edit) return
    start(async () => {
      try {
        await updateLoanProductAdmin(edit.id, {
          name: form.name,
          minAmount: form.minAmount,
          maxAmount: form.maxAmount,
          minTerm: Number(form.minTerm),
          maxTerm: Number(form.maxTerm),
          monthlyRate: form.monthlyRate,
          tna: form.tna,
        })
        toast.success('Producto actualizado')
        setEdit(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo guardar el producto')
      }
    })
  }

  function toggle(p: ProductRow) {
    start(async () => {
      try {
        await updateLoanProductAdmin(p.id, { active: !p.active })
        toast.success(p.active ? 'Producto oculto del simulador' : 'Producto publicado')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
      }
    })
  }

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile label="Monto mínimo" value={activos.length ? formatARS(montoMin) : '—'} hint="El más bajo entre los productos activos" />
        <MetricTile label="Monto máximo" value={activos.length ? formatARS(montoMax) : '—'} hint="El más alto entre los productos activos" />
        <MetricTile label="Plazo" value={activos.length ? `${plazoMin} a ${plazoMax} cuotas` : '—'} hint="Rango habilitado" />
        <MetricTile
          label="Productos activos"
          value={String(activos.length)}
          hint={`${products.length - activos.length} inactivo(s)`}
          tone={activos.length ? 'ok' : 'warn'}
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <header className="shrink-0 border-b border-border px-3 py-1.5">
          <h3 className="text-[12px] font-semibold">Productos de crédito</h3>
          <p className="text-[10px] text-muted-foreground">Tabla loan_product · define lo que el cliente puede pedir</p>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Plazo</TableHead>
                <TableHead className="text-right">TNA</TableHead>
                <TableHead className="text-right">Tasa mensual</TableHead>
                <TableHead className="text-right">CFT est.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No hay productos cargados. Corré <code className="font-mono">npm run db:seed</code>.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.type}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatARS(p.minAmount)} — {formatARS(p.maxAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {p.minTerm} — {p.maxTerm}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(p.tna)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(p.monthlyRate)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatPct(estimatedCft(p.monthlyRate))}
                    </TableCell>
                    <TableCell>
                      {p.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={() => open(p)}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" disabled={pending} onClick={() => toggle(p)}>
                          {p.active ? 'Ocultar' : 'Publicar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-[11px] text-amber-900">
          Rechazo automático bajo {SCORE_REJECT_BELOW}. Calificación desde {SCORE_AUTO_QUALIFY_AT}. Tope de cuota {Math.round(INCOME_DTI_RATIO * 100)}% del ingreso. Primer crédito tope {formatARS(FIRST_CREDIT_HARD_CAP)}. Punitorios 0%. Umbrales en código (deploy).
        </p>
      </div>

      <Dialog open={Boolean(edit)} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
            <DialogDescription>El cambio aplica al simulador y a las nuevas solicitudes. Los créditos ya otorgados no se reescriben.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setSet({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Monto mínimo</Label>
              <Input value={form.minAmount} onChange={(e) => setSet({ ...form, minAmount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Monto máximo</Label>
              <Input value={form.maxAmount} onChange={(e) => setSet({ ...form, maxAmount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Plazo mínimo</Label>
              <Input value={form.minTerm} onChange={(e) => setSet({ ...form, minTerm: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Plazo máximo</Label>
              <Input value={form.maxTerm} onChange={(e) => setSet({ ...form, maxTerm: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tasa mensual (%)</Label>
              <Input value={form.monthlyRate} onChange={(e) => setSet({ ...form, monthlyRate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>TNA (%)</Label>
              <Input value={form.tna} onChange={(e) => setSet({ ...form, tna: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={save}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OpsFloor>
  )
}
