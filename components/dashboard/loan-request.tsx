'use client'

import { requestLoan } from '@/app/actions/loans'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import { loanProduct } from '@/lib/db/schema'
import { useActionState, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Scale,
  Sparkles,
  X,
} from 'lucide-react'

type LoanProduct = typeof loanProduct.$inferSelect

interface RequestResult {
  ok: boolean
  status?: 'approved' | 'rejected'
  score?: number
  band?: 'excelente' | 'bueno' | 'regular' | 'bajo'
  reasons?: string[]
  rejectionReason?: string | null
  loanId?: string
  error?: string
  amount?: number
  installment?: number
}

function defaultProduct(products: LoanProduct[]) {
  return products.find((p) => p.id === 'prod_personal') ?? products[0]
}

function defaultTerm(product?: LoanProduct) {
  if (!product) return 12
  return Math.max(product.minTerm, Math.min(12, product.maxTerm))
}

export function LoanRequestSimulator({ products }: { products: LoanProduct[] }) {
  const initial = defaultProduct(products)
  const [selectedProductId, setSelectedProductId] = useState<string>(initial?.id ?? '')
  const [amount, setAmount] = useState<number>(
    initial ? Math.min(500000, Number(initial.maxAmount)) : 50000,
  )
  const [term, setTerm] = useState<number>(defaultTerm(initial))
  const [purpose, setPurpose] = useState<string>('')
  const [resultModal, setResultModal] = useState<RequestResult | null>(null)

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  )

  // Al cambiar de producto, monto y plazo se recortan a los límites del nuevo.
  // Se ajusta durante el render: con un efecto el usuario llegaría a ver por un
  // instante un importe fuera de rango.
  const [syncedProductId, setSyncedProductId] = useState(selectedProductId)
  if (selectedProduct && syncedProductId !== selectedProductId) {
    setSyncedProductId(selectedProductId)
    setAmount((prev) =>
      Math.max(Number(selectedProduct.minAmount), Math.min(prev, Number(selectedProduct.maxAmount))),
    )
    setTerm((prev) => {
      const next = Math.max(selectedProduct.minTerm, Math.min(prev, selectedProduct.maxTerm))
      return next === prev ? next : defaultTerm(selectedProduct)
    })
  }

  const amortization = useMemo(() => {
    if (!selectedProduct) return null
    return computeFrenchAmortization(amount, term, Number(selectedProduct.monthlyRate))
  }, [selectedProduct, amount, term])

  const [_formState, action, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      try {
        const res = await requestLoan({
          productId: formData.get('productId') as string,
          amount: Number(formData.get('amount') as string),
          term: Number(formData.get('term') as string),
          purpose: formData.get('purpose') as string,
        })
        setResultModal({
          ...(res as RequestResult),
          amount,
          installment: amortization?.installmentAmount,
        })
        return res
      } catch (err) {
        setResultModal({ ok: false, error: (err as Error).message })
        return { ok: false, error: (err as Error).message }
      }
    },
    null,
  )

  const availableTerms = useMemo(() => {
    if (!selectedProduct) return []
    const all = [1, 3, 6, 9, 12, 18, 24, 36, 48]
    const allowed = all.filter(
      (t) => t >= selectedProduct.minTerm && t <= selectedProduct.maxTerm,
    )
    if (!allowed.includes(selectedProduct.minTerm)) allowed.unshift(selectedProduct.minTerm)
    return allowed
  }, [selectedProduct])

  const bandColor: Record<string, string> = {
    excelente: 'text-emerald-600 dark:text-emerald-400',
    bueno: 'text-sky-600 dark:text-sky-400',
    regular: 'text-amber-600 dark:text-amber-400',
    bajo: 'text-rose-600 dark:text-rose-400',
  }

  const bandLabel: Record<string, string> = {
    excelente: 'Excelente',
    bueno: 'Bueno',
    regular: 'Regular',
    bajo: 'Bajo',
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-5">
      {/* Simulator Card */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Solicitar crédito</CardTitle>
                <CardDescription>
                  Simulá tu cuota, elegí el producto y enviá la solicitud.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form action={action}>
            <input type="hidden" name="productId" value={selectedProductId} />
            <input type="hidden" name="amount" value={amount} />
            <input type="hidden" name="term" value={term} />

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Producto</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(v) => setSelectedProductId(v ?? '')}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccioná un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            TNA {formatPercent(p.tna)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Monto: {formatARS(selectedProduct.minAmount)} —{' '}
                    {formatARS(selectedProduct.maxAmount)} · Plazo:{' '}
                    {selectedProduct.minTerm} a {selectedProduct.maxTerm} meses
                  </p>
                )}
              </div>

              {selectedProduct && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Monto solicitado</Label>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatARS(amount)}
                      </span>
                    </div>
                    <Slider
                      value={[amount]}
                      min={Number(selectedProduct.minAmount)}
                      max={Number(selectedProduct.maxAmount)}
                      step={10000}
                      onValueChange={(v) => setAmount(Array.isArray(v) ? v[0] : (v as number))}
                      aria-label="Monto del crédito"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>{formatARS(selectedProduct.minAmount)}</span>
                      <span>{formatARS(selectedProduct.maxAmount)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Cantidad de cuotas</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableTerms.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTerm(t)}
                          className={`h-9 w-14 rounded-md border text-sm font-medium transition-colors ${
                            term === t
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:border-primary/50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purpose">Motivo / Destino</Label>
                    <Input
                      id="purpose"
                      name="purpose"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="Ej: Refacción de casa, compra de vehículo, etc."
                    />
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 border-t">
              <Button type="submit" size="lg" disabled={isPending || !selectedProduct}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Solicitar este crédito
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Resume Card */}
      <div className="lg:col-span-2">
        <Card className="overflow-hidden sticky top-24">
          <div className="bg-sidebar px-6 py-5">
            <p className="text-sm font-medium text-sidebar-foreground/70">Cuota estimada</p>
            {amortization && (
              <p className="mt-1 font-mono text-3xl font-bold text-sidebar-foreground">
                {formatARS(amortization.installmentAmount)}
                <span className="ml-1 text-base font-normal text-sidebar-foreground/60">
                  /mes
                </span>
              </p>
            )}
          </div>
          <CardContent className="space-y-4 p-6">
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedProduct?.name ?? '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {amount ? formatARS(amount) : '—'} en {term} {term === 1 ? 'cuota' : 'cuotas'}
              </p>
            </div>
            <Separator />
            {amortization ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total a devolver</dt>
                  <dd className="font-mono font-semibold">
                    {formatARS(amortization.totalAmount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Intereses</dt>
                  <dd className="font-mono">{formatARS(amortization.totalInterest)}</dd>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">TNA</dt>
                  <dd className="font-mono">{formatPercent(amortization.tna)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">CFT (con IVA)</dt>
                  <dd className="font-mono">{formatPercent(amortization.cft)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seleccioná un producto para ver los detalles.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10 shadow-xl">
            <div
              className={`px-6 py-5 ${
                resultModal.status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : resultModal.status === 'rejected'
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    : 'bg-muted text-foreground'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  {resultModal.status === 'approved' ? (
                    <CheckCircle2 className="h-7 w-7 shrink-0" />
                  ) : resultModal.status === 'rejected' ? (
                    <AlertCircle className="h-7 w-7 shrink-0" />
                  ) : (
                    <AlertCircle className="h-7 w-7 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">
                      {resultModal.status === 'approved'
                        ? '¡Tu crédito fue aprobado!'
                        : resultModal.status === 'rejected'
                          ? 'En este momento no podemos aprobar tu solicitud'
                          : 'Resultado de la solicitud'}
                    </h3>
                    <p className="mt-0.5 text-sm opacity-80">
                      {resultModal.status === 'approved'
                        ? 'El plan de cuotas se habilita cuando UNICRÉDITOS acredite el desembolso en tu CBU o CVU.'
                        : resultModal.status === 'rejected'
                          ? 'No es un rechazo definitivo. Podés volver a solicitar cuando tu perfil o tus ingresos hayan cambiado.'
                          : 'Revisá los detalles.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setResultModal(null)}
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              {resultModal.status === 'approved' && resultModal.amount ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center ring-1 ring-emerald-100">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Monto aprobado</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-800">{formatARS(resultModal.amount)}</p>
                  {resultModal.installment ? (
                    <p className="mt-1 text-sm text-emerald-700">Cuota estimada {formatARS(resultModal.installment)}</p>
                  ) : null}
                </div>
              ) : null}
              {resultModal.score !== undefined && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Score crediticio</p>
                      <p
                        className={`mt-1 font-mono text-2xl font-bold ${
                          resultModal.band ? bandColor[resultModal.band] : 'text-foreground'
                        }`}
                      >
                        {resultModal.score}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <Badge
                        variant={
                          resultModal.band === 'excelente' || resultModal.band === 'bueno'
                            ? 'default'
                            : resultModal.band === 'regular'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {resultModal.band ? bandLabel[resultModal.band] : '—'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {resultModal.rejectionReason && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-400">
                  <p className="font-semibold">Motivo</p>
                  <p className="mt-1">{resultModal.rejectionReason}</p>
                </div>
              )}

              {resultModal.reasons && resultModal.reasons.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Consideraciones de la evaluación
                  </p>
                  <ul className="space-y-1.5">
                    {resultModal.reasons.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {resultModal.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {resultModal.error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
              <Button variant="outline" onClick={() => setResultModal(null)}>
                Cerrar
              </Button>
              {resultModal.status === 'approved' && (
                <Button
                  onClick={() => {
                    setResultModal(null)
                    window.location.assign('/dashboard?tab=cuotas')
                  }}
                >
                  Ver mi crédito
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
