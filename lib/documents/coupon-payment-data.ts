import QRCode from 'qrcode'
import { addDaysAR, endOfDayAR } from '@/lib/date-ar'

/**
 * Medios de cobro que se imprimen en cada talón de la cuponera. Solo Mercado Pago:
 * - QR por cuota (enlace firmado que abre el checkout de Mercado Pago con el importe exacto).
 * - Códigos de barras de Pago Fácil y Rapipago que emite Mercado Pago.
 *
 * Mercado Pago emite los tickets de Pago Fácil y Rapipago con un vencimiento de 1 a 30 días.
 * Por eso el código de barras solo se imprime en las cuotas que vencen dentro de la ventana;
 * las demás muestran desde qué fecha se habilita y el QR, que sirve siempre.
 * Si falta algo que debería estar, la cuponera queda en borrador y no se imprime.
 */

/** 30 días de vigencia máxima del ticket menos 3 de margen para que siga vivo al vencer la cuota. */
export const BARCODE_WINDOW_DAYS = 27

export type CouponNetwork = 'pagofacil' | 'rapipago'

export type CouponNetworkCode = {
  network: CouponNetwork
  label: 'Pago Fácil' | 'Rapipago'
  /** Contenido del código de barras que entrega Mercado Pago (solo dígitos). */
  barcode: string | null
  /** Número de pago para cargar a mano en la caja. */
  paymentCode: string | null
  expiresAt: string
}

export type CouponTalonPay = {
  installmentId: string
  number: number
  qrUrl: string | null
  qrSvg: string | null
  /** Fecha desde la que Mercado Pago emite los códigos de esta cuota; null = ya están en la ventana. */
  barcodesFrom: string | null
  pagoFacil: CouponNetworkCode | null
  rapipago: CouponNetworkCode | null
}

export type CouponBookPay = {
  talons: Record<string, CouponTalonPay>
  problems: string[]
  /** true solo si cada talón tiene lo que le corresponde: se puede imprimir. */
  final: boolean
}

export function isOpenInstallment(status: string) {
  return status !== 'paid' && status !== 'cancelled'
}

/** Pura: fecha desde la que se pueden emitir los códigos de red de una cuota, o null si ya se puede. */
export function barcodesAvailableFrom(dueDate: Date | string, now = new Date()): Date | null {
  const opensAt = addDaysAR(endOfDayAR(new Date(dueDate)), -BARCODE_WINDOW_DAYS)
  return opensAt.getTime() <= now.getTime() ? null : opensAt
}

/** Pura: decide qué falta en la cuponera. */
export function resolveCouponBook(talons: CouponTalonPay[], extraProblems: string[] = []): CouponBookPay {
  const problems = [...extraProblems]
  for (const t of talons) {
    if (!t.qrSvg) problems.push(`Cuota ${t.number}: no se pudo generar el QR de Mercado Pago.`)
    if (!t.barcodesFrom) {
      if (!t.pagoFacil) problems.push(`Cuota ${t.number}: Mercado Pago no emitió el código de Pago Fácil.`)
      if (!t.rapipago) problems.push(`Cuota ${t.number}: Mercado Pago no emitió el código de Rapipago.`)
    }
  }
  return {
    talons: Object.fromEntries(talons.map((t) => [t.installmentId, t])),
    problems,
    final: problems.length === 0,
  }
}

export async function qrSvgFromPayload(payload: string | null | undefined) {
  const text = String(payload ?? '').trim()
  if (!text) return null
  try {
    return await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
  } catch {
    return null
  }
}

export type CashTicket = { barcode: string | null; operationNumber: string | null; expiresAt: string } | null

export function asNetworkCode(network: CouponNetwork, ticket: CashTicket): CouponNetworkCode | null {
  if (!ticket) return null
  const barcode = ticket.barcode && /^\d+$/.test(ticket.barcode) ? ticket.barcode : null
  const paymentCode = ticket.operationNumber || null
  if (!barcode && !paymentCode) return null
  return { network, label: network === 'pagofacil' ? 'Pago Fácil' : 'Rapipago', barcode, paymentCode, expiresAt: ticket.expiresAt }
}
