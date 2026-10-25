'use client'

import {
  SectionCard,
  StatusChip,
} from '@/components/unicred/dashboard-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  formatARS,
} from '@/lib/finance'
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/labels'
import {
  payment,
  savedPaymentMethod,
} from '@/lib/db/schema'
import { useState, useEffect, KeyboardEvent } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Wallet,
  XCircle,
  Receipt,
  ArrowLeft,
  Check,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { PayInstallmentDialog, payCta } from '@/components/payments/pay-installment-dialog'

type PaymentType = typeof payment.$inferSelect
type SavedMethodType = typeof savedPaymentMethod.$inferSelect

type UpcomingInstallment = {
  id: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
  loanId: string
  loanPrincipal: string | number
  loanTerm: number
  loanStatus: string
  loanPurpose: string | null
}

export function PagosPanel({
  installments,
  savedMethods,
  isPending,
  payerEmail,
}: {
  installments: UpcomingInstallment[]
  savedMethods: SavedMethodType[]
  isPending: boolean
  payerEmail?: string | null
}) {
  const pending = [...installments]
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .sort((a, b) => new Date(a.dueDate as any).getTime() - new Date(b.dueDate as any).getTime())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [method, setMethod] = useState<any>('tarjeta_credito')
  const [step, setStep] = useState<'list' | 'checkout'>('list')
  const [payOpen, setPayOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const payFromUrl = searchParams.get('pay') || searchParams.get('cuota')
  const methodFromUrl = searchParams.get('method')
  const pendingIds = pending.map((row) => row.id).join(',')

  useEffect(() => {
    if (!payFromUrl) return
    if (!pendingIds.split(',').includes(payFromUrl)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((ids) => (ids.includes(payFromUrl) ? ids : [...ids, payFromUrl]))
    setStep('checkout')
    if (
      methodFromUrl &&
      ['tarjeta_credito', 'tarjeta_debito', 'pago_facil', 'rapipago', 'ticket', 'transferencia_bancaria', 'payway_wallet'].includes(
        methodFromUrl,
      )
    ) {
      setMethod(methodFromUrl)
      setPayOpen(true)
    }
  }, [payFromUrl, methodFromUrl, pendingIds])

  const toggle = (id: string) =>
    setSelectedIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]))

  const totalSel = pending
    .filter((i) => selectedIds.includes(i.id))
    .reduce((acc, i) => acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0), 0)

  const openCheckout = (ids?: string[]) => {
    if (ids?.length) setSelectedIds(ids)
    const next = ids ?? selectedIds
    if (!next.length) return
    setStep('checkout')
  }

  const clearPayQuery = () => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.has('pay') || sp.has('cuota') || sp.has('method')) {
      sp.delete('pay')
      sp.delete('cuota')
      sp.delete('method')
      const next = sp.toString()
      router.replace(next ? `/dashboard/pagos?${next}` : '/dashboard/pagos')
    }
  }

  const backToList = () => {
    setStep('list')
    setPayOpen(false)
    clearPayQuery()
  }

  if (step === 'checkout' && selectedIds.length > 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={backToList}>
          <ArrowLeft className="h-4 w-4" /> Volver a cuotas pendientes
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formulario de pago</CardTitle>
            <CardDescription>
              {selectedIds.length} cuota{selectedIds.length === 1 ? '' : 's'} · total{' '}
              <span className="font-semibold text-foreground">{formatARS(totalSel)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 rounded-xl border bg-muted/20 p-3 text-sm">
              {pending
                .filter((i) => selectedIds.includes(i.id))
                .map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      Cuota {i.number}/{i.loanTerm}
                      <span className="text-muted-foreground"> · {i.loanPurpose || 'Préstamo'}</span>
                    </span>
                    <span className="shrink-0 font-mono font-semibold">{formatARS(i.amount)}</span>
                  </li>
                ))}
            </ul>

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger>
                  <SelectValue>{paymentMethodLabel(method)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tarjeta_credito">Tarjeta de crédito</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta de débito</SelectItem>
                  <SelectItem value="pago_facil">Pago Fácil (efectivo)</SelectItem>
                  <SelectItem value="rapipago">Rapipago (efectivo)</SelectItem>
                  <SelectItem value="payway_wallet">Billetera UNICRÉDITOS</SelectItem>
                  <SelectItem value="transferencia_bancaria">Transferencia a RM (tesorería)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {method === 'transferencia_bancaria'
                  ? 'Vas a ver el CBU de RM International Group. Transferí, subí el comprobante y tesorería acredita cuando vea el dinero.'
                  : method === 'tarjeta_credito' || method === 'tarjeta_debito'
                    ? 'Se abre el formulario de tarjeta en este punto de venta. No tenés que entrar a tu cuenta de Mercado Pago.'
                    : method === 'payway_wallet'
                      ? 'Se abre tu billetera UNICRÉDITOS: CVU, saldo y pago inmediato de la cuota.'
                      : 'Se emite solo el cupón de este medio. Tiene vencimiento: imprimilo o pagalo ahora.'}
              </p>
            </div>

            {savedMethods.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Métodos guardados</p>
                <div className="grid gap-2">
                  {savedMethods.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className="flex w-full items-center justify-between rounded-lg border bg-card p-2.5 text-left text-xs hover:border-brand-primary/40"
                      onClick={() => {
                        setMethod(m.type === 'card' ? 'tarjeta_credito' : method)
                        setPayOpen(true)
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {m.brand ?? m.type} {m.last4 && `**** ${m.last4}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {m.nickname ?? m.type}
                            {m.isDefault && ' · Default'}
                          </p>
                        </div>
                      </div>
                      {m.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          ✓
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t bg-muted/20 pt-4">
            <Button
              disabled={isPending || selectedIds.length === 0}
              className="w-full gap-1.5"
              onClick={() => {
                if (
                  (method === 'pago_facil' || method === 'rapipago') &&
                  selectedIds.length !== 1
                ) {
                  toast.error('Pago Fácil y Rapipago: emití un cupón por cuota (elegí una sola).')
                  return
                }
                setPayOpen(true)
              }}
            >
              <Wallet className="h-4 w-4" />
              {payCta(method)}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              El cobro es del titular de la plataforma. Tarjeta se procesa en este punto de venta. Pago Fácil y Rapipago
              se emiten al confirmar el medio. La transferencia a RM la concilia tesorería.
            </p>
            <PayInstallmentDialog
              open={payOpen}
              onClose={() => {
                setPayOpen(false)
                clearPayQuery()
              }}
              email={payerEmail}
              method={method}
              onSettled={() => router.refresh()}
              installments={pending
                .filter((i) => selectedIds.includes(i.id))
                .map((i) => ({
                  id: i.id,
                  number: i.number,
                  amount: i.amount,
                  dueDate: i.dueDate,
                  loanId: i.loanId,
                }))}
            />
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <SectionCard
      title="Cuotas pendientes"
      description="Seleccioná una o más cuotas y tocá Pagar para abrir el formulario. El historial está en Pagos → Historial."
      icon={<Wallet className="h-4 w-4" />}
      action={
        <Badge variant="outline" className="text-xs">
          {pending.length} pendiente{pending.length === 1 ? '' : 's'}
        </Badge>
      }
      bodyClassName="space-y-4 p-4 sm:p-5"
    >
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium">¡Sin cuotas pendientes!</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Estás al día. Cuando haya cuotas nuevas aparecerán acá.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Préstamo</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((i) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const due = new Date(i.dueDate as any)
                    due.setHours(0, 0, 0, 0)
                    const daysLate = Math.round((today.getTime() - due.getTime()) / 86400000)
                    const overdue = i.status !== 'paid' && daysLate > 0
                    const sel = selectedIds.includes(i.id)
                    return (
                      <TableRow
                        key={i.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          sel && 'bg-primary/5',
                        )}
                        onClick={() => toggle(i.id)}
                        onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggle(i.id)
                          }
                        }}
                      >
                        <TableCell>
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border',
                              sel ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                            )}
                          >
                            {sel && <Check className="h-3 w-3" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{i.loanPurpose || 'Préstamo personal'}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatARS(i.loanPrincipal)} · {i.loanTerm} cuotas
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {i.number} / {i.loanTerm}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">
                            {new Date(i.dueDate as any).toLocaleDateString('es-AR', {
                              timeZone: 'America/Argentina/Buenos_Aires',
                            })}
                          </div>
                          {overdue && (
                            <Badge variant="destructive" className="mt-1 h-4 py-0 text-[10px]">
                              {daysLate} días atrasada
                            </Badge>
                          )}
                          {!overdue && daysLate >= -7 && daysLate <= 0 && (
                            <Badge className="mt-1 h-4 bg-amber-500 py-0 text-[10px] hover:bg-amber-500">
                              Próxima · {Math.abs(daysLate)}d
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatARS(i.amount)}</TableCell>
                        <TableCell>
                          <StatusChip status={overdue ? 'vencido' : 'pendiente'} />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              openCheckout([i.id])
                            }}
                          >
                            Pagar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Seleccionadas: </span>
                <span className="font-semibold">{selectedIds.length}</span>
                {selectedIds.length > 0 && (
                  <>
                    <span className="text-muted-foreground"> · Total </span>
                    <span className="font-mono font-bold">{formatARS(totalSel)}</span>
                  </>
                )}
              </div>
              <Button
                type="button"
                className="gap-1.5"
                disabled={selectedIds.length === 0}
                onClick={() => openCheckout()}
              >
                <Wallet className="h-4 w-4" /> Pagar seleccionadas
              </Button>
            </div>
          </>
        )}
    </SectionCard>
  )
}

export function HistorialPagosPanel({ payments }: { payments: PaymentType[] }) {
  if (payments.length === 0) {
    return (
      <SectionCard
        title="Historial de pagos"
        description="Acá aparecen los pagos registrados en tu cuenta."
        icon={<Receipt className="h-4 w-4" />}
      >
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Todavía no hay pagos</p>
            <p className="max-w-xs text-xs text-muted-foreground">Cuando pagues una cuota, el movimiento queda listado acá.</p>
          </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Historial de pagos"
      description={`${payments.length} movimiento${payments.length === 1 ? '' : 's'} · los comprobantes PDF están en Comprobantes.`}
      icon={<Receipt className="h-4 w-4" />}
      bodyClassName="space-y-2 p-4 sm:p-5"
    >
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl',
                  p.status === 'paid'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : p.status === 'pending'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {p.status === 'paid' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : p.status === 'pending' ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{paymentMethodLabel(p.method)}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {p.referenceNumber ?? p.id.slice(0, 10)} ·{' '}
                  {new Date(p.createdAt as any).toLocaleDateString('es-AR', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                  })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold">{formatARS(p.amount)}</p>
              <p className="text-[11px] text-muted-foreground">{paymentStatusLabel(p.status)}</p>
            </div>
          </div>
        ))}
    </SectionCard>
  )
}

