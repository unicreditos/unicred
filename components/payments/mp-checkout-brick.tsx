'use client'

import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import { useEffect, useState } from 'react'

export function MercadoPagoCheckoutBrick({
  publicKey,
  amount,
  preferenceId,
  email,
  localPaymentId,
  onPaid,
  onError,
}: {
  publicKey: string
  amount: number
  preferenceId: string
  email?: string | null
  localPaymentId: string
  onPaid: (status: string) => void
  onError: (message: string) => void
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'es-AR' })
    setReady(true)
  }, [publicKey])

  if (!ready) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Cargando Mercado Pago…</p>
  }

  return (
    <Payment
      initialization={{
        amount,
        preferenceId,
        payer: email ? { email } : undefined,
      }}
      customization={{
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          ticket: 'all',
          bankTransfer: 'all',
          maxInstallments: 12,
        },
      }}
      onSubmit={async ({ formData }) => {
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
        onPaid(String(data.status || 'pending'))
        return data
      }}
      onError={(error) => {
        onError(error?.message || 'No se pudo abrir el checkout de Mercado Pago.')
      }}
    />
  )
}
