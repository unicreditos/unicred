'use client'

import { requestConsumoAtMerchant } from '@/app/actions/merchant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatARS } from '@/lib/finance'
import { CONSUMO_QUOTE } from '@/lib/loan-catalog'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export function OnlineConsumoForm({
  merchants,
  initialMerchantId,
}: {
  merchants: { id: string; businessName: string; category: string | null; city: string | null }[]
  initialMerchantId?: string
}) {
  const router = useRouter()
  const [merchantId, setMerchantId] = useState(
    initialMerchantId && merchants.some((m) => m.id === initialMerchantId)
      ? initialMerchantId
      : (merchants[0]?.id ?? ''),
  )
  const [amount, setAmount] = useState(String(CONSUMO_QUOTE.referenceAmount))
  const [term, setTerm] = useState(String(CONSUMO_QUOTE.referenceTerm))
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  function submit() {
    start(async () => {
      const res = await requestConsumoAtMerchant({
        merchantId,
        amount: Number(amount),
        term: Number(term),
        note,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.status === 'rejected') {
        toast.error(res.rejectionReason || 'Solicitud rechazada.')
        return
      }
      toast.success(
        res.status === 'approved'
          ? `Aprobado en ${res.merchantName}. Cuota ${formatARS(res.installmentAmount)}. Firmá el contrato en tu panel.`
          : `En revisión · ${res.merchantName}. Te avisamos al confirmar.`,
      )
      router.push('/dashboard?tab=mis_solicitudes')
    })
  }

  if (merchants.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        Todavía no hay comercios activos en la red. Pedile al local que se adhiera en{' '}
        <a className="font-semibold text-brand-primary" href="/comercios">
          UNICRÉDITOS Comercios
        </a>
        .
      </p>
    )
  }

  return (
    <div className="space-y-4 rounded-3xl border border-brand-primary/15 bg-card p-5 sm:p-6">
      <div className="space-y-2">
        <Label>Comercio</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
        >
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.businessName}
              {m.city ? ` · ${m.city}` : ''}
              {m.category ? ` · ${m.category}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Monto de la compra (ARS)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label>Cuotas</Label>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Detalle (opcional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. notebook, moto, electrodoméstico"
        />
      </div>
      <Button className="font-bold" disabled={pending || !merchantId} onClick={submit}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Solicitar financiación
      </Button>
      <p className="text-xs text-muted-foreground">
        Requiere cuenta UNICRÉDITOS, Didit aprobado e ingresos declarados. TNA/CFT se confirman en el
        contrato. Tope de referencia consumo: {formatARS(CONSUMO_QUOTE.maxAmount)}.
      </p>
    </div>
  )
}
