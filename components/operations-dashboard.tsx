'use client'

import { FileCheck2, FileText, Receipt, ShieldAlert, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatARS } from '@/lib/finance'

type Loan = { id: string; principal: string; status: string; term: number; createdAt: Date | string }
type Installment = { id: string; number: number; amount: string; dueDate: Date | string; status: string }
type Payment = { id: string; status: string; amount: string }
type Document = { id: string; type: string; status: string; createdAt: Date | string }

export type OperationsProps = {
  loans: Loan[]
  installments: Installment[]
  payments: Payment[]
  documents: Document[]
}

const labels: Record<string, string> = {
  pending: 'En evaluación', approved: 'Aprobado', active: 'Activo', rejected: 'Rechazado',
  paid: 'Cancelado', overdue: 'Vencida', created: 'Iniciado', confirmed: 'Confirmado', failed: 'Fallido',
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value))
}

function EmptyState({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><FileCheck2 className="mx-auto mb-2 size-5" />{children}</div>
}

export function OperationsDashboard({ loans, installments, payments, documents }: OperationsProps) {
  const pending = installments.filter((item) => item.status === 'pending' || item.status === 'overdue').length
  const paid = installments.filter((item) => item.status === 'paid').length
  const confirmedPayments = payments.filter((item) => item.status === 'confirmed').length

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
    <div>
      <p className="text-sm font-medium text-primary">Mi cuenta / Operaciones</p>
      <h1 className="text-3xl font-bold tracking-tight">Créditos y documentación</h1>
      <p className="mt-1 text-muted-foreground">Información registrada en tu cuenta. Si no hay un registro confirmado, no mostramos una operación.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-4">
      <Metric label="Créditos registrados" value={loans.length} />
      <Metric label="Cuotas pendientes" value={pending} />
      <Metric label="Cuotas pagadas" value={paid} />
      <Metric label="Pagos confirmados" value={confirmedPayments} />
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" />Mis créditos</CardTitle></CardHeader>
      <CardContent>
        {loans.length === 0 ? <EmptyState>Todavía no hay créditos registrados en tu cuenta.</EmptyState> : <div className="space-y-3">{loans.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Crédito {item.id.slice(0, 8)}</p><p className="text-sm text-muted-foreground">Solicitado el {formatDate(item.createdAt)} · {item.term} cuotas</p></div><div className="text-left sm:text-right"><p className="font-mono font-semibold">{formatARS(Number(item.principal))}</p><Badge variant="outline">{labels[item.status] ?? item.status}</Badge></div></div>)}</div>}
      </CardContent>
    </Card>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-5 text-primary" />Cuotas y pagos</CardTitle></CardHeader>
        <CardContent>{installments.length === 0 ? <EmptyState>Las cuotas aparecerán cuando exista un crédito desembolsado y documentado.</EmptyState> : <div className="space-y-2">{installments.map((item) => <div key={item.id} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="font-medium">Cuota {item.number}</p><p className="text-xs text-muted-foreground">Vencimiento: {formatDate(item.dueDate)}</p></div><div className="text-right"><p className="font-mono text-sm font-semibold">{formatARS(Number(item.amount))}</p><Badge variant="outline">{labels[item.status] ?? item.status}</Badge></div></div>)}</div>}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />Contratos y comprobantes</CardTitle></CardHeader>
        <CardContent>{documents.length === 0 ? <EmptyState>No hay contratos, recibos ni comprobantes emitidos para tu cuenta.</EmptyState> : <div className="space-y-2">{documents.map((item) => <div key={item.id} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="font-medium">{item.type}</p><p className="text-xs text-muted-foreground">Emitido: {formatDate(item.createdAt)}</p></div><Badge variant="outline">{labels[item.status] ?? item.status}</Badge></div>)}</div>}</CardContent>
      </Card>
    </div>

    <Card className="border-primary/20 bg-primary/5"><CardContent className="flex gap-3 p-5"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">Medios de pago y documentos</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Mercado Pago, tarjetas, QR, transferencia, Pago Fácil y Rapipago no están habilitados en esta instalación. No se aceptan pagos ni se emiten recibos desde esta pantalla hasta conectar y homologar un proveedor.</p></div></CardContent></Card>
  </main>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-3xl font-bold">{value}</p></CardContent></Card>
}
