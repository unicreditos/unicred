import { publicBrandWebsite } from '@/lib/brand'
import { formatARSDecimal } from '@/lib/finance'
import { installmentPosPath as dashboardPosPath } from '@/lib/workspace-gate'

export function installmentPayPath(installmentId: string) {
  return `/pagar/${installmentId}`
}

/** Caja de cobro dentro del dashboard. El talón impreso sigue usando /pagar/… */
export function installmentPosPath(installmentId: string, method?: string) {
  return dashboardPosPath(installmentId, method)
}

export function installmentPayUrl(installmentId: string, origin?: string) {
  const base = (origin || publicBrandWebsite()).replace(/\/$/, '')
  return `${base}${installmentPayPath(installmentId)}`
}

const CODE128_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','11000111010',
]

function dueStamp(dueDate: Date | string) {
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function couponCode(input: {
  loanId: string
  number: number
  dueDate: Date | string
  amount: number | string
}) {
  const loan = input.loanId.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase()
  const n = String(input.number).padStart(2, '0')
  const cents = String(Math.round((Number(input.amount) || 0) * 100)).padStart(10, '0')
  return `UC${loan}${n}${dueStamp(input.dueDate)}${cents}`
}

export function parseCouponCode(code: string) {
  const raw = code.trim().toUpperCase()
  const match = raw.match(/^UC([A-Z0-9]{6,10})(\d{2})(\d{8})(\d{10})$/)
  if (!match) return null
  const [, loan, number, due, cents] = match
  return {
    loanKey: loan,
    number: Number(number),
    dueDate: `${due.slice(0, 4)}-${due.slice(4, 6)}-${due.slice(6, 8)}`,
    amount: Number(cents) / 100,
  }
}

function encodeCode128B(text: string) {
  const START_B = 104
  const STOP = 106
  const values = [START_B]
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 127) throw new Error('El cupón solo admite ASCII imprimible')
    values.push(code - 32)
  }
  const checksum = values.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : index), 0) % 103
  values.push(checksum, STOP)
  return values.map((v) => CODE128_PATTERNS[v]).join('') + '11'
}

export type BarcodeSvgOpts = {
  height?: number
  module?: number
  /** Si es false, el número se imprime en HTML a tamaño legible. */
  showText?: boolean
  /** Escala el SVG al 100% del contenedor (imprescindible en A4). */
  fit?: boolean
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** Agrupa el número del cupón para leerlo en el local sin recortar dígitos. */
export function formatBarcodeHuman(value: string) {
  const raw = String(value ?? '').replace(/\s+/g, '')
  if (!raw) return ''
  if (/^\d+$/.test(raw)) {
    return (raw.match(/.{1,4}/g) ?? [raw]).join(' ')
  }
  return raw
}

/** Nº de operación de Pago Fácil / Rapipago, agrupado como en el ticket de Mercado Pago. */
export function formatOperationNumber(value: string) {
  return formatBarcodeHuman(String(value ?? '').replace(/\D/g, ''))
}

export function barcodeSvg(text: string, opts?: BarcodeSvgOpts) {
  const bits = encodeCode128B(text)
  const bar = opts?.module ?? 1.6
  const height = opts?.height ?? 46
  const showText = opts?.showText !== false
  const textBand = showText ? 16 : 0
  const quiet = 10
  const width = bits.length * bar + quiet * 2
  const svgH = height + textBand
  let x = quiet
  let rects = ''
  for (const bit of bits) {
    if (bit === '1') {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${bar}" height="${height}" fill="#0f172a"/>`
    }
    x += bar
  }
  const label = xmlEscape(text)
  const textEl = showText
    ? `<text x="${(width / 2).toFixed(1)}" y="${height + 13}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#334155">${label}</text>`
    : ''
  const widthAttr = opts?.fit ? '100%' : width.toFixed(1)
  const fitClass = opts?.fit ? ' doc-barcode-fit' : ''
  const fitStyle = opts?.fit ? ' style="width:100%;max-width:100%;height:auto;display:block"' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" class="doc-barcode${fitClass}" width="${widthAttr}" height="${svgH}" viewBox="0 0 ${width.toFixed(1)} ${svgH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}"${fitStyle}>${rects}${textEl}</svg>`
}

export function couponLabel(input: {
  loanId: string
  number: number
  dueDate: Date | string
  amount: number | string
}) {
  return {
    code: couponCode(input),
    amountLabel: formatARSDecimal(input.amount),
    dueStamp: dueStamp(input.dueDate),
  }
}
