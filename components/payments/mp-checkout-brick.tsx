'use client'

import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import { brickPaymentMethods, type BrickChannel } from '@/lib/payments/brick-methods'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type { BrickChannel }

export function MercadoPagoCheckoutBrick({
  publicKey,
  amount,
  email,
  localPaymentId,
  channel = 'all',
  customerId = null,
  cardIds = [],
  onPaid,
  onError,
}: {
  publicKey: string
  amount: number
  email?: string | null
  localPaymentId: string
  channel?: BrickChannel
  customerId?: string | null
  cardIds?: string[]
  onPaid: (status: string, extra?: { receiptId?: string | null; credited?: number }) => void
  onError: (message: string) => void
}) {
  const [ready, setReady] = useState(false)
  const methods = useMemo(() => brickPaymentMethods(channel), [channel])
  const initialization = useMemo(() => {
    const payer = {
      ...(email ? { email } : {}),
      ...(customerId ? { customerId } : {}),
      ...(cardIds.length ? { cardsIds: cardIds } : {}),
    }
    return {
      amount,
      ...(Object.keys(payer).length ? { payer } : {}),
    }
  }, [amount, email, customerId, cardIds])
  const customization = useMemo(
    () => ({
      paymentMethods: methods,
    }),
    [methods],
  )

  const handleSubmit = useCallback(
    async ({ formData }: { formData: Record<string, unknown> }) => {
      const res = await fetch('/api/payments/mp-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, localPaymentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onError(data.error || 'Mercado Pago rechazó el cobro.')
        throw new Error(data.error || 'Pago rechazado')
      }
      onPaid(String(data.status || 'pending'), {
        receiptId: data.receiptId ?? null,
        credited: Number(data.credited) || 0,
      })
      return data
    },
    [localPaymentId, onError, onPaid],
  )

  const handleError = useCallback(
    (error: { message?: string }) => {
      onError(error?.message || 'No se pudo abrir el checkout de Mercado Pago.')
    },
    [onError],
  )

  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'es-AR' })
    setReady(true)
  }, [publicKey])

  if (!ready) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Cargando Mercado Pago…</p>
  }

  return (
    <Payment
      id={`paymentBrick_${localPaymentId}`}
      locale="es-AR"
      initialization={initialization}
      customization={customization}
      onSubmit={handleSubmit as never}
      onError={handleError}
    />
  )
}
