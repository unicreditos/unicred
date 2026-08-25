export type BrickChannel =
  | 'all'
  | 'ticket'
  | 'pago_facil'
  | 'rapipago'
  | 'credit_card'
  | 'debit_card'
  | 'account_money'

export function brickPaymentMethods(channel: BrickChannel = 'all') {
  if (channel === 'ticket' || channel === 'pago_facil' || channel === 'rapipago') {
    return { ticket: 'all' as const, maxInstallments: 1 }
  }
  if (channel === 'credit_card') {
    return { creditCard: 'all' as const, maxInstallments: 12 }
  }
  if (channel === 'debit_card') {
    return { debitCard: 'all' as const, maxInstallments: 1 }
  }
  if (channel === 'account_money') {
    return { mercadoPago: 'all' as const, maxInstallments: 1 }
  }
  return {
    creditCard: 'all' as const,
    debitCard: 'all' as const,
    ticket: 'all' as const,
    mercadoPago: 'all' as const,
    maxInstallments: 12,
  }
}
