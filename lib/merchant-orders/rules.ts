/**
 * Reglas de la venta financiada en comercios adheridos. Puras (sin base ni red) para poder probarlas:
 *
 *  - El cliente paga un ANTICIPO del 30% del precio directamente a UNICRÉDITOS (QR o transferencia).
 *  - UNICRÉDITOS financia el 70% restante: ese es el capital del crédito a nombre del cliente.
 *  - La mesa de créditos aprueba cada operación a mano. El comercio entrega el producto recién
 *    cuando el cliente firmó y el anticipo está acreditado (lo prueba el código de entrega).
 *  - Lo entregado se liquida al comercio el viernes siguiente a la entrega o, si ese viernes no es
 *    hábil, el próximo día hábil. Neto = precio total − comisión del comercio.
 */
import { arDateKey } from '@/lib/date-ar'
import { computeFrenchAmortization } from '@/lib/finance'

/** Anticipo obligatorio sobre el precio de contado. */
export const DOWN_PAYMENT_RATE = 0.3

export type OrderItemInput = { productId: string; name: string; unitPrice: number; quantity: number }
export type OrderItem = OrderItemInput & { subtotal: number }

const cents = (n: number) => Math.round(n * 100) / 100

export function normalizeItems(items: OrderItemInput[]): OrderItem[] {
  return items
    .filter((i) => i.quantity > 0)
    .map((i) => ({ ...i, quantity: Math.floor(i.quantity), subtotal: cents(i.unitPrice * Math.floor(i.quantity)) }))
}

export type OrderQuote = {
  items: OrderItem[]
  total: number
  downPayment: number
  financed: number
  term: number
  monthlyRate: number
  installmentAmount: number
  totalFinancedRepayment: number
  tna: number
  tea: number
  cft: number
  commissionRate: number
  commission: number
  netToMerchant: number
}

/**
 * Cotización de la operación. El anticipo se redondea hacia arriba al peso entero (el cliente nunca
 * paga menos del 30%) y el financiado es exactamente el resto, así anticipo + financiado = precio.
 */
export function quoteOrder(input: {
  items: OrderItemInput[]
  term: number
  monthlyRate: number
  commissionRate: number
}): OrderQuote {
  const items = normalizeItems(input.items)
  const total = cents(items.reduce((s, i) => s + i.subtotal, 0))
  const downPayment = Math.min(total, Math.ceil(total * DOWN_PAYMENT_RATE))
  const financed = cents(total - downPayment)
  const amort = financed > 0 ? computeFrenchAmortization(financed, input.term, input.monthlyRate) : null
  const commission = cents((total * input.commissionRate) / 100)
  return {
    items,
    total,
    downPayment,
    financed,
    term: input.term,
    monthlyRate: input.monthlyRate,
    installmentAmount: amort?.installmentAmount ?? 0,
    totalFinancedRepayment: amort?.totalAmount ?? 0,
    tna: amort?.tna ?? 0,
    tea: amort?.tea ?? 0,
    cft: amort?.cft ?? 0,
    commissionRate: input.commissionRate,
    commission,
    netToMerchant: cents(total - commission),
  }
}

/* ------------------------------ Etapas ------------------------------ */

export type OrderStage =
  | 'en_revision'
  | 'esperando_cliente'
  | 'lista_para_entregar'
  | 'entregada'
  | 'liquidada'
  | 'rechazada'
  | 'anulada'

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  en_revision: 'En revisión de la mesa',
  esperando_cliente: 'Esperando firma y anticipo',
  lista_para_entregar: 'Lista para entregar',
  entregada: 'Entregada · a liquidar',
  liquidada: 'Liquidada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
}

export type DownPaymentStatus = 'pending' | 'reported' | 'confirmed' | 'rejected'

export const DOWN_PAYMENT_LABEL: Record<DownPaymentStatus, string> = {
  pending: 'Pendiente',
  reported: 'Informado · en revisión',
  confirmed: 'Acreditado',
  rejected: 'Rechazado',
}

/** La etapa sale del estado del crédito y de los hitos de la orden: no hay un estado que se desincronice. */
export function orderStage(input: {
  loanStatus: string
  contractSigned: boolean
  downPaymentStatus: string
  deliveredAt: Date | string | null
  cancelledAt: Date | string | null
  settlementPaid: boolean
}): OrderStage {
  if (input.cancelledAt || input.loanStatus === 'cancelled') return 'anulada'
  if (input.loanStatus === 'rejected') return 'rechazada'
  if (input.deliveredAt) return input.settlementPaid ? 'liquidada' : 'entregada'
  if (input.loanStatus === 'pending') return 'en_revision'
  if (input.loanStatus === 'approved') {
    return input.contractSigned && input.downPaymentStatus === 'confirmed' ? 'lista_para_entregar' : 'esperando_cliente'
  }
  return 'en_revision'
}

/** Pasos pendientes del cliente antes de poder retirar el producto. */
export function customerPendingSteps(input: { contractSigned: boolean; downPaymentStatus: string }) {
  const steps: string[] = []
  if (!input.contractSigned) steps.push('Firmar el contrato y el pagaré')
  if (input.downPaymentStatus !== 'confirmed') {
    steps.push(input.downPaymentStatus === 'reported' ? 'Esperar que tesorería acredite el anticipo' : 'Pagar el anticipo del 30%')
  }
  return steps
}

/* ------------------------- Plazo del cliente ------------------------- */

/** Días desde la aprobación para firmar y pagar el anticipo. Después la operación se anula sola. */
export const DOWN_PAYMENT_WINDOW_DAYS = 10
/** Recordatorios al cliente: a los 2 días y a los 7 de aprobada. */
export const REMINDER_DAYS = [2, 7] as const

export type FollowUp = { kind: 'expire' } | { kind: 'remind'; daysLeft: number | null } | null

/**
 * Qué hacer hoy con una operación aprobada que espera al cliente. No vence si el anticipo ya se cobró (habría
 * que devolverlo: lo decide una persona) ni si hay una transferencia informada esperando a tesorería.
 */
export function followUpFor(input: { ageDays: number; remindersSent: number; downPaymentStatus: string; contractSigned: boolean }): FollowUp {
  const paid = input.downPaymentStatus === 'confirmed'
  const inReview = input.downPaymentStatus === 'reported'
  if (paid && input.contractSigned) return null
  if (!paid && !inReview && input.ageDays >= DOWN_PAYMENT_WINDOW_DAYS) return { kind: 'expire' }
  const due = REMINDER_DAYS.filter((d) => input.ageDays >= d).length
  const needsAction = !input.contractSigned || (!paid && !inReview)
  if (due > input.remindersSent && needsAction) {
    return { kind: 'remind', daysLeft: paid || inReview ? null : Math.max(0, Math.ceil(DOWN_PAYMENT_WINDOW_DAYS - input.ageDays)) }
  }
  return null
}

/* ------------------------- Calendario de liquidación ------------------------- */

/**
 * Feriados nacionales y días no laborables (puentes) en que los bancos no operan. Es la lista de respaldo
 * (fuente: calendario oficial publicado en api.argentinadatos.com); el cron diario guarda los años nuevos en
 * `bank_holiday` y el servidor los suma con `registerBankHolidays` antes de calcular fechas de pago.
 */
export const AR_BANK_HOLIDAYS = new Set<string>([
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-23', '2026-03-24', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20', '2026-07-09', '2026-07-10', '2026-08-17',
  '2026-10-12', '2026-11-09', '2026-11-23', '2026-12-07', '2026-12-08', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-24', '2027-03-26', '2027-04-02', '2027-05-01',
  '2027-05-25', '2027-06-17', '2027-06-20', '2027-07-09', '2027-08-17', '2027-10-12', '2027-11-20',
  '2027-12-08', '2027-12-25',
])

const DATE_KEY_RX = /^\d{4}-\d{2}-\d{2}$/

/** Suma feriados al calendario (los que el cron trajo de la fuente oficial). Ignora fechas mal formadas. */
export function registerBankHolidays(dates: Iterable<string>) {
  for (const d of dates) if (DATE_KEY_RX.test(d)) AR_BANK_HOLIDAYS.add(d)
}

/** Último año con feriados cargados: si es el actual, falta el calendario del año que viene. */
export function lastHolidayYear() {
  let max = 0
  for (const d of AR_BANK_HOLIDAYS) max = Math.max(max, Number(d.slice(0, 4)))
  return max
}

function keyToUtc(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function utcToKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDaysKey(key: string, days: number) {
  const d = keyToUtc(key)
  d.setUTCDate(d.getUTCDate() + days)
  return utcToKey(d)
}

export function isBusinessDay(key: string) {
  const dow = keyToUtc(key).getUTCDay()
  return dow !== 0 && dow !== 6 && !AR_BANK_HOLIDAYS.has(key)
}

/**
 * Fecha de pago de una entrega: el primer viernes POSTERIOR al día de entrega (hora argentina). Si ese
 * viernes no es hábil, el próximo día hábil. Una entrega del jueves se cobra al día siguiente; una del
 * viernes, el viernes siguiente (el lote del día ya está cerrado).
 */
export function settlementDateFor(deliveredAt: Date | string | number): string {
  const key = arDateKey(deliveredAt)
  const dow = keyToUtc(key).getUTCDay()
  const toFriday = ((5 - dow + 7) % 7) || 7
  let pay = addDaysKey(key, toFriday)
  while (!isBusinessDay(pay)) pay = addDaysKey(pay, 1)
  return pay
}

/** Próxima fecha de liquidación si se entregara hoy. */
export function nextSettlementDate(now: Date = new Date()) {
  return settlementDateFor(now)
}

export function formatPayDate(key: string) {
  const d = keyToUtc(key)
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const [y, m, dd] = key.split('-')
  return `${weekday} ${dd}/${m}/${y}`
}

/* ------------------------------ Identificadores ------------------------------ */

/** Código de entrega de 6 dígitos (lo ve el cliente; lo carga el comercio al entregar). */
export function newDeliveryCode(random: () => number = Math.random) {
  return String(Math.floor(random() * 1_000_000)).padStart(6, '0')
}

/** Código corto y legible de la operación (sin 0/O ni 1/I para dictarlo por teléfono). */
export function newOrderCode(random: () => number = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(random() * alphabet.length)]
  return `OP-${out}`
}

/** Referencia del QR del anticipo: la reconoce el webhook de Mercado Pago. */
export function downPaymentExternalRef(orderId: string) {
  return `ANT_${orderId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)}_${Date.now().toString(36)}`.slice(0, 64)
}

export function isDownPaymentRef(ref: string | null | undefined) {
  return typeof ref === 'string' && ref.startsWith('ANT_')
}
