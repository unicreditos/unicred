const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const TEENS = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
]
const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
]

function chunk(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  if (n < 10) return UNITS[n]
  if (n < 20) return TEENS[n - 10]
  if (n < 30) return n === 20 ? 'veinte' : `veinti${UNITS[n - 20]}`
  if (n < 100) {
    const u = n % 10
    return u ? `${TENS[Math.floor(n / 10)]} y ${UNITS[u]}` : TENS[Math.floor(n / 10)]
  }
  const c = Math.floor(n / 100)
  const rest = n % 100
  return rest ? `${HUNDREDS[c]} ${chunk(rest)}` : HUNDREDS[c]
}

/** Ante "mil": uno → un, veintiuno → veintiún (norma gramatical española). */
function thousandsPhrase(n: number): string {
  if (n === 1) return 'mil'
  let w = chunk(n)
  w = w
    .replace(/\bveintiuno\b/gi, 'veintiún')
    .replace(/\buno\b/gi, 'un')
  return `${w} mil`
}

export function amountInWords(value: number | string): string {
  const n = Math.round((Number(value) || 0) * 100) / 100
  const integer = Math.floor(n)
  const cents = Math.round((n - integer) * 100)
  if (integer === 0) return `cero pesos${cents ? ` con ${String(cents).padStart(2, '0')}/100` : ''}`

  const millions = Math.floor(integer / 1_000_000)
  const thousands = Math.floor((integer % 1_000_000) / 1000)
  const rest = integer % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'un millón' : `${chunk(millions)} millones`)
  if (thousands) parts.push(thousandsPhrase(thousands))
  if (rest) parts.push(chunk(rest))
  const pesos = parts.join(' ').replace(/\s+/g, ' ').trim()
  return `${pesos} pesos${cents ? ` con ${String(cents).padStart(2, '0')}/100` : ''}`.toUpperCase()
}

export function frenchInstallmentSplit(
  principal: number,
  monthlyRatePct: number,
  term: number,
  installmentNumber: number,
) {
  const i = monthlyRatePct / 100
  const cuota =
    i === 0
      ? principal / term
      : (principal * (i * Math.pow(1 + i, term))) / (Math.pow(1 + i, term) - 1)
  let balance = principal
  let interest = 0
  let capital = 0
  for (let k = 1; k <= installmentNumber && k <= term; k++) {
    interest = i === 0 ? 0 : balance * i
    capital = Math.min(cuota - interest, balance)
    balance = Math.max(0, balance - capital)
  }
  return {
    installment: Math.round(cuota * 100) / 100,
    interest: Math.round(interest * 100) / 100,
    capital: Math.round(capital * 100) / 100,
    balance: Math.round(balance * 100) / 100,
  }
}
