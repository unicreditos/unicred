/** Reglas puras del listado admin de todos los creditos: etiquetas de estado y marca de aprobacion automatica. */
import { isAutoGenerator } from '@/lib/auto-approval-revert'

export const LOAN_LIST_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  pending: { label: 'En revisi\u00f3n', tone: 'warning' },
  approved: { label: 'Aprobado', tone: 'info' },
  active: { label: 'Vigente', tone: 'success' },
  paid: { label: 'Saldado', tone: 'neutral' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  cancelled: { label: 'Anulado', tone: 'neutral' },
}

export const AUTO_APPROVED_LABEL = 'Aprobado autom\u00e1ticamente (por puntaje)'
export const MANUAL_LABEL = 'Manual'

/** Un credito es "automatico" si su contrato lo emitio un flujo de puntaje (no una persona). */
export function loanOriginLabel(generatedBy: string | null | undefined): string {
  return isAutoGenerator(generatedBy) ? AUTO_APPROVED_LABEL : MANUAL_LABEL
}

export function loanStatusBadge(status: string) {
  const s = LOAN_LIST_STATUS[status]
  return { l: s?.label ?? status, t: s?.tone ?? ('neutral' as const) }
}