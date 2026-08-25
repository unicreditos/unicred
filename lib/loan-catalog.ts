import { computeFrenchAmortization, formatPercent } from '@/lib/finance'

/** Catálogo operativo. Misma fuente que el seed y la web pública. */
export const LOAN_CATALOG = [
  {
    id: 'prod_personal',
    type: 'personal' as const,
    name: 'Préstamo Personal UNICRÉDITOS',
    minAmount: 50_000,
    maxAmount: 3_000_000,
    minTerm: 3,
    maxTerm: 48,
    monthlyRate: 7.5,
    referenceAmount: 500_000,
    referenceTerm: 12,
  },
  {
    id: 'prod_consumo',
    type: 'consumo' as const,
    name: 'Crédito de Consumo en Cuotas',
    minAmount: 10_000,
    maxAmount: 1_000_000,
    minTerm: 1,
    maxTerm: 24,
    monthlyRate: 8.2,
    referenceAmount: 200_000,
    referenceTerm: 12,
  },
  {
    id: 'prod_comercio',
    type: 'comercio' as const,
    name: 'Financiación Comercio',
    minAmount: 20_000,
    maxAmount: 5_000_000,
    minTerm: 1,
    maxTerm: 24,
    monthlyRate: 6.9,
    referenceAmount: 500_000,
    referenceTerm: 12,
  },
] as const

export type LoanCatalogType = (typeof LOAN_CATALOG)[number]['type']

export function catalogByType(type: LoanCatalogType) {
  const row = LOAN_CATALOG.find((p) => p.type === type)
  if (!row) throw new Error(`Producto ${type} no definido`)
  return row
}

export function catalogQuote(type: LoanCatalogType) {
  const product = catalogByType(type)
  const amort = computeFrenchAmortization(product.referenceAmount, product.referenceTerm, product.monthlyRate)
  return {
    ...product,
    tna: amort.tna,
    tea: amort.tea,
    cft: amort.cft,
    installmentAmount: amort.installmentAmount,
    tnaLabel: formatPercent(amort.tna),
    cftLabel: formatPercent(amort.cft),
    metric: `TNA ${formatPercent(amort.tna)} · CFT ${formatPercent(amort.cft)}`,
    metricHint: `Referencia ${product.referenceAmount.toLocaleString('es-AR')} a ${product.referenceTerm} meses · solo interés e IVA`,
  }
}

export const PERSONAL_QUOTE = catalogQuote('personal')
export const CONSUMO_QUOTE = catalogQuote('consumo')
export const COMERCIO_QUOTE = catalogQuote('comercio')
