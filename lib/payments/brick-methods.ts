export type BrickChannel =
  | 'all'
  | 'ticket'
  | 'pago_facil'
  | 'rapipago'
  | 'credit_card'
  | 'debit_card'
  | 'account_money'

export function brickPaymentMethods(channel: BrickChannel = 'all') {
  if (channel === 'pago_facil') {
    return {
      ticket: 'all' as const,
      maxInstallments: 1,
      excludedPaymentMethods: [{ id: 'rapipago' }],
    }
  }
  if (channel === 'rapipago') {
    return {
      ticket: 'all' as const,
      maxInstallments: 1,
      excludedPaymentMethods: [{ id: 'pagofacil' }],
    }
  }
  if (channel === 'ticket') {
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
    maxInstallments: 12,
  }
}

/**
 * Card Payment Brick. Mercado Pago documenta `types.excluded`, no `included`.
 * Con `included: ['credit_card']` el brick compara todos los medios de la
 * cuenta y corta al abrir con `payment_method_not_in_allowed_types`.
 * Crédito excluye débito (hasta 12 cuotas). Débito excluye crédito (1 cuota).
 * La prepaga no se excluye: varias tarjetas de la cuenta se informan así.
 */
export function cardBrickPaymentMethods(channel: 'credit_card' | 'debit_card') {
  return {
    maxInstallments: channel === 'debit_card' ? 1 : 12,
    types: {
      excluded: [channel === 'debit_card' ? 'credit_card' : 'debit_card'] as Array<'credit_card' | 'debit_card'>,
    },
  }
}
