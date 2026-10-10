import { eq } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import type { GridRow } from '@/components/uc/grid-types'
import { ButtonLink, PageHead } from '@/components/uc/blocks'
import { db } from '@/lib/db'
import { paymentReceipt } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'
import { loadCustomerPayments, loadCustomerShell } from '@/lib/customer/load'
import { PAYMENT_LABEL, PAYMENT_TONE, solRef } from '@/lib/customer/view'
import { documentPrintPath } from '@/lib/documents/customer-view'

export const metadata = { title: 'Historial de pagos' }

const METHOD: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  transferencia_bancaria: 'Transferencia',
  transferencia_rm: 'Transferencia',
  transferencia: 'Transferencia',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  rapipago: 'Rapipago',
  pago_facil: 'Pago Fácil',
  ticket: 'Efectivo',
}

export default async function HistorialPagosPage() {
  const { userId } = await loadCustomerShell()
  const [payments, receipts] = await Promise.all([
    loadCustomerPayments(userId),
    db
      .select({ id: paymentReceipt.id, paymentId: paymentReceipt.paymentId, receiptNumber: paymentReceipt.receiptNumber })
      .from(paymentReceipt)
      .where(eq(paymentReceipt.userId, userId))
      .limit(100)
      .catch(() => []),
  ])
  const receiptByPayment = new Map(receipts.filter((r) => r.paymentId).map((r) => [r.paymentId as string, r]))

  const rows: GridRow[] = payments.map((p) => {
    const r = receiptByPayment.get(p.id)
    const label = PAYMENT_LABEL[p.status] ?? p.status
    return {
      id: p.id,
      fecha: new Date((p.paidAt ?? p.createdAt) as Date).toISOString(),
      credito: p.loanId ? solRef(p.loanId) : '—',
      q: `${p.id} ${r?.receiptNumber ?? ''}`,
      importe: Number(p.amount) || 0,
      medio: METHOD[p.method] ?? p.method,
      estado: badge(label, PAYMENT_TONE[p.status] ?? 'neutral'),
      estadoKey: label,
      recibo: r ? [{ kind: 'link' as const, label: r.receiptNumber, icon: 'download' as const, href: documentPrintPath('recibo', r.id) }] : [],
    }
  })

  return (
    <>
      <PageHead
        title="Historial de pagos"
        description="Todos tus pagos, con su comprobante."
        actions={<ButtonLink primary href="/dashboard/pagos">Pagar una cuota</ButtonLink>}
      />
      <DataGrid
        cfg={{
          id: 'mispagos',
          rows,
          pageSize: 10,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['q', 'credito'],
          searchPlaceholder: 'N° de pago o recibo',
          selects: [{ key: 'credito', label: 'Crédito', all: 'Crédito: todos' }],
          empty: 'Todavía no hiciste pagos.',
          columns: [
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'credito', label: 'Crédito', kind: 'num' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'medio', label: 'Medio' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Pendiente', 'En revisión', 'Acreditado', 'Rechazado'] },
            { key: 'recibo', label: 'Comprobante', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'pagos', sumKey: 'importe', sumLabel: 'en total' },
        }}
      />
    </>
  )
}
