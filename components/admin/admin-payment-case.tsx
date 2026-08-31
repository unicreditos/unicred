'use client'

import type { AdminPaymentCase } from '@/app/actions/admin-cases'
import { Button } from '@/components/ui/button'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { adminClientHref, adminLoanHref, adminUrl } from '@/lib/admin-nav'
import { formatARS } from '@/lib/finance'
import {
  installmentStatusLabel,
  loanStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/labels'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-sm text-brand-navy-900 ${mono ? 'font-mono' : ''}`}>
        {value || value === 0 ? String(value) : '—'}
      </p>
    </div>
  )
}

export function AdminPaymentCaseView({ data }: { data: AdminPaymentCase }) {
  const { payment, customer, loan, installment, receipts } = data
  const tone =
    payment.status === 'paid' ? 'ok' : payment.status === 'failed' || payment.status === 'cancelled' ? 'critical' : 'warn'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-slate-600">
        <Link href={adminUrl('pagos')}>
          <ArrowLeft /> Pagos
        </Link>
      </Button>

      <DecisionBanner
        tone={tone}
        title={paymentStatusLabel(payment.status)}
        detail={payment.failureReason || payment.notes || `${paymentMethodLabel(payment.method)} · ${payment.gateway || payment.source}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Importe" value={formatARS(payment.amount)} hint={payment.currency} />
        <MetricTile label="Medio" value={paymentMethodLabel(payment.method)} hint={payment.gateway || payment.source} />
        <MetricTile label="Acreditado" value={fmtDate(payment.paidAt)} hint={fmtDate(payment.createdAt)} />
        <MetricTile label="Recibos" value={String(receipts.length)} />
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cliente" value={customer.name} />
          <Field label="Correo" value={customer.email} />
          <Field label="CUIL" value={customer.cuil} mono />
          <Field label="ID pago" value={payment.id} mono />
          <Field label="ID externo" value={payment.externalId} mono />
          <Field label="Referencia" value={payment.referenceNumber} mono />
          <Field
            label="Crédito"
            value={loan ? `${loanStatusLabel(loan.status)} · ${formatARS(loan.principal)}` : '—'}
          />
          <Field
            label="Cuota"
            value={
              installment
                ? `#${installment.number} · ${installmentStatusLabel(installment.status)}`
                : '—'
            }
          />
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border px-4 py-3 text-xs">
          <Link href={adminClientHref(customer.id)} className="text-brand-primary hover:underline">
            Ficha del cliente
          </Link>
          {loan ? (
            <Link href={adminLoanHref(loan.id, loan.status)} className="text-brand-primary hover:underline">
              Expediente del crédito
            </Link>
          ) : null}
        </div>
      </section>

      {receipts.length > 0 ? (
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Comprobantes</h3>
          </header>
          <ul className="divide-y">
            {receipts.map((r) => (
              <li key={r.id} className="flex justify-between px-4 py-2 text-sm">
                <span className="font-mono text-xs">{r.receiptNumber}</span>
                <span>
                  {r.receiptType} · {formatARS(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
