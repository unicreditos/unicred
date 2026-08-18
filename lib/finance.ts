// Utilidades financieras para el cálculo de préstamos en cuotas (sistema francés).

export type Amortization = {
  installmentAmount: number
  totalAmount: number
  totalInterest: number
  tna: number
  cft: number
  schedule: { number: number; amount: number }[]
}

/**
 * Sistema francés de amortización: cuota fija.
 * @param principal  Capital solicitado
 * @param term       Cantidad de cuotas (meses)
 * @param monthlyRate Tasa de interés mensual en porcentaje (ej: 7.5 = 7,5%)
 */
export function computeFrenchAmortization(
  principal: number,
  term: number,
  monthlyRate: number,
): Amortization {
  const i = monthlyRate / 100
  const installmentAmount =
    i === 0
      ? principal / term
      : (principal * (i * Math.pow(1 + i, term))) / (Math.pow(1 + i, term) - 1)

  const roundedInstallment = Math.round(installmentAmount * 100) / 100
  const totalAmount = Math.round(roundedInstallment * term * 100) / 100
  const totalInterest = Math.round((totalAmount - principal) * 100) / 100

  const tna = Math.round(i * 12 * 100 * 100) / 100
  // CFT aproximado (TEA) incluyendo IVA sobre intereses.
  const tea = (Math.pow(1 + i, 12) - 1) * 100
  const cft = Math.round(tea * 1.21 * 100) / 100

  const schedule = Array.from({ length: term }, (_, idx) => ({
    number: idx + 1,
    amount: roundedInstallment,
  }))

  return {
    installmentAmount: roundedInstallment,
    totalAmount,
    totalInterest,
    tna,
    cft,
    schedule,
  }
}

export function formatARS(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(isNaN(n) ? 0 : n)
}

export function formatARSDecimal(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n)
}

export function formatPercent(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(isNaN(n) ? 0 : n)}%`
}
