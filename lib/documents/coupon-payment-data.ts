import QRCode from 'qrcode'
import { TREASURY_ACCOUNT } from '@/lib/treasury'

/**
 * Datos de cobro de UNICRÉDITOS que se imprimen en cada cupón de la cuponera.
 *
 * Fuente ÚNICA: `lib/treasury.ts` (variables de entorno TREASURY_*, leídas solo en el servidor).
 * Este módulo valida, arma el QR de transferencia y calcula qué falta.
 * Regla de seguridad: la cuponera solo se puede imprimir/emitir como definitiva si no falta
 * ningún dato requerido (`final === true`). Si falta algo se muestra el marcador
 * "DATO PENDIENTE DE CONFIRMAR" y la impresión queda bloqueada.
 */

export type CouponPaymentField = 'bank' | 'holder' | 'cuit' | 'accountNumber' | 'cbu' | 'alias' | 'qr'

export const COUPON_PAYMENT_REQUIRED: readonly CouponPaymentField[] = [
  'bank',
  'holder',
  'cuit',
  'accountNumber',
  'cbu',
  'alias',
  'qr',
]

export const COUPON_PAYMENT_FIELD_LABELS: Record<CouponPaymentField, string> = {
  bank: 'Banco',
  holder: 'Titular',
  cuit: 'CUIT',
  accountNumber: 'N° de cuenta corriente',
  cbu: 'CBU',
  alias: 'Alias',
  qr: 'QR de transferencia',
}

export type CouponPaymentRaw = {
  bank?: string | null
  holder?: string | null
  cuit?: string | null
  accountType?: string | null
  accountNumber?: string | null
  cbu?: string | null
  alias?: string | null
  qrPayload?: string | null
}

export type CouponPaymentData = {
  bank: string | null
  holder: string | null
  cuit: string | null
  accountType: string
  accountNumber: string | null
  cbu: string | null
  alias: string | null
  /** SVG del QR de transferencia (ya generado en el servidor) o null si falta. */
  qrSvg: string | null
  missing: CouponPaymentField[]
  /** true solo si no falta ningún dato requerido y no es un ejemplo. */
  final: boolean
  /** true = datos ficticios de demostración (nunca emitible). */
  example: boolean
}

function clean(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  return text || null
}

export function normalizeCuit(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

export function normalizeCbu(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 22 ? digits : null
}

export function normalizeAlias(value: string | null | undefined) {
  const text = String(value ?? '').trim().replace(/^@/, '')
  return /^[A-Za-z0-9.\-]{6,20}$/.test(text) ? text : null
}

export function formatCuit(digits: string | null) {
  if (!digits) return null
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

/** Pura y testeable: decide qué datos están completos. */
export function resolveCouponPaymentData(
  raw: CouponPaymentRaw,
  qrSvg: string | null,
  opts: { example?: boolean } = {},
): CouponPaymentData {
  const data = {
    bank: clean(raw.bank),
    holder: clean(raw.holder),
    cuit: normalizeCuit(raw.cuit),
    accountType: clean(raw.accountType) ?? 'Cuenta corriente',
    accountNumber: clean(raw.accountNumber),
    cbu: normalizeCbu(raw.cbu),
    alias: normalizeAlias(raw.alias),
    qrSvg: qrSvg && clean(raw.qrPayload) ? qrSvg : null,
  }
  const missing = COUPON_PAYMENT_REQUIRED.filter((field) => {
    if (field === 'qr') return !data.qrSvg
    return !data[field]
  })
  const example = Boolean(opts.example)
  return { ...data, missing, final: missing.length === 0 && !example, example }
}

export async function qrSvgFromPayload(payload: string | null | undefined) {
  const text = clean(payload)
  if (!text) return null
  try {
    return await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
  } catch {
    return null
  }
}

/** Solo servidor: lee TREASURY_* y genera el QR. */
export async function loadCouponPaymentData(): Promise<CouponPaymentData> {
  const qrPayload = TREASURY_ACCOUNT.qrPayload
  const qrSvg = await qrSvgFromPayload(qrPayload)
  return resolveCouponPaymentData(
    {
      bank: TREASURY_ACCOUNT.bank,
      holder: TREASURY_ACCOUNT.holder,
      cuit: TREASURY_ACCOUNT.cuit,
      accountType: TREASURY_ACCOUNT.accountType,
      accountNumber: TREASURY_ACCOUNT.accountNumber,
      cbu: TREASURY_ACCOUNT.cbu,
      alias: TREASURY_ACCOUNT.alias,
      qrPayload,
    },
    qrSvg,
  )
}

export function couponPaymentMissingLabels(data: Pick<CouponPaymentData, 'missing'>) {
  return data.missing.map((field) => COUPON_PAYMENT_FIELD_LABELS[field])
}
