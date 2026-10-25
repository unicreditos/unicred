/**
 * Conceptos de una transferencia bancaria (mismos códigos que las transferencias a cuentas de otros bancos en la API
 * de BIND). Es un módulo puro: lo usan el formulario del navegador y el servidor.
 */
export const TRANSFER_CONCEPTS = [
  { code: 'VAR', label: 'Varios' },
  { code: 'ALQ', label: 'Alquiler' },
  { code: 'CUO', label: 'Cuota' },
  { code: 'EXP', label: 'Expensas' },
  { code: 'FAC', label: 'Factura' },
  { code: 'PRE', label: 'Préstamo' },
  { code: 'SEG', label: 'Seguro' },
  { code: 'HON', label: 'Honorarios' },
  { code: 'HAB', label: 'Haberes' },
] as const

export type TransferConceptCode = (typeof TRANSFER_CONCEPTS)[number]['code']

export function isConceptCode(value: string): value is TransferConceptCode {
  return TRANSFER_CONCEPTS.some((c) => c.code === value)
}

export function conceptLabel(code: string) {
  return TRANSFER_CONCEPTS.find((c) => c.code === code)?.label ?? 'Varios'
}

/** Texto con el que se guarda y muestra el concepto: "VAR · Varios — detalle". */
export function conceptText(code: string, description?: string) {
  const base = `${isConceptCode(code) ? code : 'VAR'} · ${conceptLabel(code)}`
  const extra = String(description ?? '').trim().slice(0, 60)
  return extra ? `${base} — ${extra}` : base
}
