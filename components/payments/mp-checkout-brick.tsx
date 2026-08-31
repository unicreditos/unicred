'use client'

import { initMercadoPago, Payment, CardPayment } from '@mercadopago/sdk-react'
import { brickPaymentMethods, type BrickChannel } from '@/lib/payments/brick-methods'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type { BrickChannel }

function isCardChannel(channel: BrickChannel) {
  return channel === 'credit_card' || channel === 'debit_card'
}

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
  const cardOnly = isCardChannel(channel)
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
    () =>
      cardOnly
        ? {
            paymentMethods: {
              maxInstallments: channel === 'debit_card' ? 1 : 12,
              types: { included: [channel === 'debit_card' ? 'debit_card' : 'credit_card'] },
            },
          }
        : { paymentMethods: methods },
    [cardOnly, channel, methods],
  )

  const process = useCallback(
    async (formData: Record<string, unknown>) => {
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

  const handlePaymentSubmit = useCallback(
    async ({ formData }: { formData: Record<string, unknown> }) => process(formData),
    [process],
  )

  const handleCardSubmit = useCallback(
    async (payload: Record<string, unknown> | { formData: Record<string, unknown> }) => {
      const formData =
        payload && typeof payload === 'object' && 'formData' in payload && payload.formData
          ? (payload as { formData: Record<string, unknown> }).formData
          : (payload as Record<string, unknown>)
      return process(formData)
    },
    [process],
  )

  const handleError = useCallback(
    (error: { message?: string }) => {
      onError(error?.message || 'No se pudo abrir el punto de venta.')
    },
    [onError],
  )

  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'es-AR' })
    setReady(true)
  }, [publicKey])

  if (!ready) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Cargando punto de venta…</p>
  }

  if (cardOnly) {
    return (
      <CardPayment
        locale="es-AR"
        initialization={initialization}
        customization={customization as never}
        onSubmit={handleCardSubmit as never}
        onError={handleError}
      />
    )
  }

  return (
    <Payment
      id={`paymentBrick_${localPaymentId}`}
      locale="es-AR"
      initialization={initialization}
      customization={customization as never}
      onSubmit={handlePaymentSubmit as never}
      onError={handleError}
    />
  )
}
