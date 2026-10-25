/** Utilidades de CUIT/CUIL sin dependencias de Node: sirven en el cliente y en el servidor. */

export function normalizeCuit(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCuit(value: string): boolean {
  const cuit = normalizeCuit(value)
  if (!/^\d{11}$/.test(cuit)) return false
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cuit[i], 10) * factors[i]
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return parseInt(cuit[10], 10) === expected
}
