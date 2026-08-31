/**
 * Proxy operativo del umbral OPNFC / PNFC (TO BCRA punto 1.3.1.2).
 * El umbral formal se mide sobre el último balance auditado ($10 M).
 * Acá se usa el capital de créditos vigentes como alerta de mesa, no como
 * constancia de inscripción.
 */

export const OPNFC_THRESHOLD_ARS = 10_000_000
export const OPNFC_WARN_ARS = 8_000_000

export type OpnfcBand = 'below' | 'approaching' | 'threshold_crossed'

export function opnfcBand(outstandingPrincipal: number): OpnfcBand {
  const n = Number(outstandingPrincipal) || 0
  if (n >= OPNFC_THRESHOLD_ARS) return 'threshold_crossed'
  if (n >= OPNFC_WARN_ARS) return 'approaching'
  return 'below'
}

export function opnfcLabel(band: OpnfcBand) {
  if (band === 'threshold_crossed') {
    return 'El stock vigente cruzó el umbral de $10 M. Hay 120 días para inscribirse como PNFC por ARCA.'
  }
  if (band === 'approaching') {
    return 'El stock vigente supera $8 M. Preparar inscripción PNFC si el próximo balance cierra sobre $10 M.'
  }
  return 'Stock de financiaciones vigentes por debajo del umbral PNFC de $10 M.'
}
