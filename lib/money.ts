/** Helpers de dinero sin dependencias de servidor: sirven en el navegador y en el servidor. Todo en centavos enteros. */

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function centsOf(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Única forma de mostrar dinero en toda la app: pesos con dos decimales ($ 1.234,56). */
export function formatMoney(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  return moneyFmt.format(Number.isFinite(n) ? n : 0)
}

/** Importe abreviado para ejes de gráficos y tarjetas chicas: "$ 83,9 mil", "$ 1,3 M". Para detalle usá formatMoney. */
export function compactMoney(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n) || n === 0) return '$ 0'
  const abs = Math.abs(n)
  const fmt = (x: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(x)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$ ${fmt(abs / 1_000_000)} M`
  if (abs >= 1_000) return `${sign}$ ${fmt(abs / 1_000)} mil`
  return `${sign}$ ${fmt(abs)}`
}
