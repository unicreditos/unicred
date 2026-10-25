'use client'

import { adminCancelOrder, adminConfirmDownPayment, adminMarkSettlementPaid, adminRejectDownPayment, type OpsResult } from '@/app/admin/comercios/operaciones/actions'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const input = 'h-10 w-full rounded-lg border border-[var(--uc-line,#d7dde8)] bg-white px-3 text-sm text-slate-900'

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<OpsResult>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(ok)
        router.refresh()
      } else toast.error(r.error)
    })
  return { pending, run }
}

export function DownPaymentReview({ orderId, amount }: { orderId: string; amount: string }) {
  const { pending, run } = useRun()
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => adminConfirmDownPayment({ orderId, reference: ref }), 'Anticipo acreditado: avisamos al cliente y al comercio')
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <label className="uc-small">
          N.º de operación en el extracto (por {amount})
          <input className={input} value={ref} onChange={(e) => setRef(e.target.value)} required minLength={4} placeholder="Ej.: 000123456789" />
        </label>
        <button className="uc-btn uc-primary" disabled={pending} type="submit">Acreditar anticipo</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => adminRejectDownPayment({ orderId, note }), 'Comprobante rechazado: avisamos al cliente')
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <label className="uc-small">
          Rechazar el comprobante (motivo para el cliente)
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} required minLength={8} placeholder="Ej.: el importe no coincide con el anticipo" />
        </label>
        <button className="uc-btn" disabled={pending} type="submit">Rechazar comprobante</button>
      </form>
    </div>
  )
}

export function CancelOrderForm({ orderId, refundNeeded }: { orderId: string; refundNeeded: boolean }) {
  const { pending, run } = useRun()
  const [reason, setReason] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (refundNeeded && !confirm('El cliente ya pagó el anticipo. ¿Confirmás la anulación? Tesorería tiene que devolverle el dinero.')) return
        run(() => adminCancelOrder({ orderId, reason }), 'Operación anulada')
      }}
      style={{ display: 'grid', gap: 8 }}
    >
      <label className="uc-small">
        Motivo de la anulación
        <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
      </label>
      {refundNeeded ? <p className="uc-small" style={{ color: 'var(--uc-danger)' }}>El anticipo ya está acreditado: registrá la devolución al cliente.</p> : null}
      <button className="uc-btn" disabled={pending} type="submit">Anular operación</button>
    </form>
  )
}

export function MarkPaidForm({ settlementId, net, ready }: { settlementId: string; net: string; ready: boolean }) {
  const { pending, run } = useRun()
  const [ref, setRef] = useState('')
  if (!ready) return <span className="uc-small uc-muted">Falta la cuenta de cobro del comercio</span>
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(() => adminMarkSettlementPaid({ settlementId, transferReference: ref }), 'Liquidación marcada como transferida')
      }}
      style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}
    >
      <input className={input} style={{ width: 170 }} value={ref} onChange={(e) => setRef(e.target.value)} required minLength={4} placeholder="N.º de transferencia" aria-label={`Número de transferencia por ${net}`} />
      <button className="uc-btn uc-primary uc-sm" disabled={pending} type="submit">Transferida</button>
    </form>
  )
}
