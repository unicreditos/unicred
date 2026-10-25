import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AR_BANK_HOLIDAYS,
  customerPendingSteps,
  DOWN_PAYMENT_WINDOW_DAYS,
  followUpFor,
  isBusinessDay,
  lastHolidayYear,
  registerBankHolidays,
  newDeliveryCode,
  newOrderCode,
  orderStage,
  quoteOrder,
  settlementDateFor,
} from '../../lib/merchant-orders/rules'

const at = (iso: string) => new Date(iso)

describe('venta financiada en comercio: anticipo del 30%', () => {
  const q = quoteOrder({
    items: [
      { productId: 'p1', name: 'Heladera', unitPrice: 899_999, quantity: 1 },
      { productId: 'p2', name: 'Instalación', unitPrice: 15_000.5, quantity: 2 },
    ],
    term: 12,
    monthlyRate: 8.2,
    commissionRate: 8,
  })

  it('anticipo redondeado hacia arriba y anticipo + financiado = precio', () => {
    assert.equal(q.total, 930_000)
    assert.equal(q.downPayment, 279_000)
    assert.equal(q.financed, 651_000)
    assert.equal(q.downPayment + q.financed, q.total)
    assert.ok(q.downPayment >= q.total * 0.3)
  })

  it('el crédito se calcula solo sobre el 70% financiado', () => {
    assert.ok(q.installmentAmount > 0)
    assert.ok(q.totalFinancedRepayment > q.financed)
    assert.equal(q.cft, Math.round(q.tea * 1.21 * 100) / 100)
  })

  it('comisión sobre el precio total y neto al comercio = precio − comisión', () => {
    assert.equal(q.commission, 74_400)
    assert.equal(q.netToMerchant, 855_600)
  })

  it('ignora renglones con cantidad 0', () => {
    const z = quoteOrder({ items: [{ productId: 'a', name: 'A', unitPrice: 100, quantity: 0 }], term: 3, monthlyRate: 5, commissionRate: 8 })
    assert.equal(z.items.length, 0)
    assert.equal(z.total, 0)
    assert.equal(z.installmentAmount, 0)
  })
})

describe('etapas de la operación', () => {
  const base = { contractSigned: false, downPaymentStatus: 'pending', deliveredAt: null, cancelledAt: null, settlementPaid: false }
  it('pendiente de la mesa', () => assert.equal(orderStage({ ...base, loanStatus: 'pending' }), 'en_revision'))
  it('aprobada sin firma o sin anticipo: espera al cliente', () => {
    assert.equal(orderStage({ ...base, loanStatus: 'approved', contractSigned: true }), 'esperando_cliente')
    assert.equal(orderStage({ ...base, loanStatus: 'approved', downPaymentStatus: 'confirmed' }), 'esperando_cliente')
  })
  it('firmada y con anticipo acreditado: lista para entregar', () =>
    assert.equal(orderStage({ ...base, loanStatus: 'approved', contractSigned: true, downPaymentStatus: 'confirmed' }), 'lista_para_entregar'))
  it('entregada y liquidada', () => {
    assert.equal(orderStage({ ...base, loanStatus: 'active', deliveredAt: at('2026-10-22T15:00:00Z') }), 'entregada')
    assert.equal(orderStage({ ...base, loanStatus: 'active', deliveredAt: at('2026-10-22T15:00:00Z'), settlementPaid: true }), 'liquidada')
  })
  it('rechazo y anulación ganan sobre todo', () => {
    assert.equal(orderStage({ ...base, loanStatus: 'rejected' }), 'rechazada')
    assert.equal(orderStage({ ...base, loanStatus: 'approved', cancelledAt: at('2026-10-22T15:00:00Z') }), 'anulada')
  })
  it('pasos pendientes del cliente', () => {
    assert.deepEqual(customerPendingSteps({ contractSigned: false, downPaymentStatus: 'pending' }), [
      'Firmar el contrato y el pagaré',
      'Pagar el anticipo del 30%',
    ])
    assert.deepEqual(customerPendingSteps({ contractSigned: true, downPaymentStatus: 'confirmed' }), [])
  })
})

describe('liquidación: viernes siguiente o próximo día hábil', () => {
  // Hora argentina = UTC−3. 2026-10-22 es jueves.
  it('entrega del jueves se paga el viernes siguiente', () => assert.equal(settlementDateFor(at('2026-10-22T20:00:00Z')), '2026-10-23'))
  it('entrega del viernes pasa al viernes de la otra semana', () => assert.equal(settlementDateFor(at('2026-10-23T13:00:00Z')), '2026-10-30'))
  it('entrega del lunes', () => assert.equal(settlementDateFor(at('2026-10-26T13:00:00Z')), '2026-10-30'))
  it('el jueves 23:30 AR todavía es jueves (ya es viernes en UTC)', () =>
    assert.equal(settlementDateFor(at('2026-10-23T02:30:00Z')), '2026-10-23'))
  it('viernes feriado (Viernes Santo 2026) corre al lunes hábil', () => assert.equal(settlementDateFor(at('2026-03-31T15:00:00Z')), '2026-04-06'))
  it('viernes puente (10/07/2026) corre al lunes', () => assert.equal(settlementDateFor(at('2026-07-06T15:00:00Z')), '2026-07-13'))
  it('días hábiles', () => {
    assert.equal(isBusinessDay('2026-10-23'), true)
    assert.equal(isBusinessDay('2026-10-24'), false)
    assert.equal(isBusinessDay('2026-12-25'), false)
  })
})

describe('códigos', () => {
  it('código de entrega de 6 dígitos', () => {
    assert.equal(newDeliveryCode(() => 0), '000000')
    assert.match(newDeliveryCode(), /^\d{6}$/)
  })
  it('código de operación legible', () => assert.match(newOrderCode(), /^OP-[A-HJ-NP-Z2-9]{6}$/))
})

describe('plazo del cliente: recordatorios y vencimiento', () => {
  const base = { remindersSent: 0, downPaymentStatus: 'pending', contractSigned: false }
  it('el primer día no hace nada', () => assert.equal(followUpFor({ ...base, ageDays: 1 }), null))
  it('a los 2 días recuerda con los días que quedan', () =>
    assert.deepEqual(followUpFor({ ...base, ageDays: 2.2 }), { kind: 'remind', daysLeft: DOWN_PAYMENT_WINDOW_DAYS - 2 }))
  it('no repite un recordatorio ya enviado', () => assert.equal(followUpFor({ ...base, ageDays: 3, remindersSent: 1 }), null))
  it('a los 7 días manda el segundo', () => assert.equal(followUpFor({ ...base, ageDays: 7.1, remindersSent: 1 })?.kind, 'remind'))
  it('al vencer el plazo sin anticipo se anula', () => assert.deepEqual(followUpFor({ ...base, ageDays: 10, remindersSent: 2 }), { kind: 'expire' }))
  it('con el anticipo cobrado nunca se anula sola (habría que devolverlo)', () => {
    const r = followUpFor({ ...base, downPaymentStatus: 'confirmed', ageDays: 30, remindersSent: 0 })
    assert.deepEqual(r, { kind: 'remind', daysLeft: null })
  })
  it('con una transferencia en revisión no se anula ni se apura el pago', () => {
    assert.equal(followUpFor({ ...base, downPaymentStatus: 'reported', contractSigned: true, ageDays: 30 }), null)
    assert.deepEqual(followUpFor({ ...base, downPaymentStatus: 'reported', ageDays: 3 }), { kind: 'remind', daysLeft: null })
  })
  it('firmado y pagado no necesita seguimiento', () =>
    assert.equal(followUpFor({ ...base, downPaymentStatus: 'confirmed', contractSigned: true, ageDays: 40 }), null))
})

describe('feriados: fuente oficial con respaldo fijo', () => {
  it('el respaldo cubre el año que viene', () => assert.ok(lastHolidayYear() >= 2027))
  it('incluye los puentes en que no operan los bancos', () => {
    assert.ok(AR_BANK_HOLIDAYS.has('2026-12-07'))
    assert.ok(AR_BANK_HOLIDAYS.has('2026-07-10'))
  })
  it('suma feriados nuevos e ignora basura', () => {
    registerBankHolidays(['2030-01-01', 'no-es-fecha', '2030-13'])
    assert.ok(AR_BANK_HOLIDAYS.has('2030-01-01'))
    assert.ok(!AR_BANK_HOLIDAYS.has('no-es-fecha'))
    assert.equal(isBusinessDay('2030-01-01'), false)
    AR_BANK_HOLIDAYS.delete('2030-01-01')
  })
  it('un viernes feriado cargado desde la fuente corre la liquidación (y saltea el lunes 09/11, también feriado)', () => {
    registerBankHolidays(['2026-11-06'])
    assert.equal(settlementDateFor(at('2026-11-02T15:00:00Z')), '2026-11-10')
    AR_BANK_HOLIDAYS.delete('2026-11-06')
  })
})
