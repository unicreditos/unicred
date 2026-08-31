export function formatPeriodoBcra(periodo?: string | null) {
  const p = String(periodo ?? '').replace(/\D/g, '')
  if (p.length !== 6) return periodo || '—'
  return `${p.slice(4, 6)}/${p.slice(0, 4)}`
}

export const SITUACION_BCRA: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Riesgo medio',
  4: 'Riesgo alto',
  5: 'Irrecuperable',
}
