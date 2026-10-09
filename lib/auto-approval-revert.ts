/**
 * Planificador (puro, sin base de datos) para devolver a "en revision" los creditos que quedaron
 * aprobados automaticamente por score (generatedBy auto_score / mobile_auto / merchant_sale).
 * Solo toca creditos 'approved' SIN contrato firmado, SIN desembolso y SIN cuotas pagadas.
 */
export const AUTO_GENERATORS = ['auto_score', 'mobile_auto', 'merchant_sale'] as const

export type AutoApprovedRow = {
  loanId: string
  userId: string
  loanStatus: string
  principal: string | number
  scoreAtApproval: number | null
  generatedBy: string | null
  contractId: string | null
  contractStatus: string | null
  acceptedAt: Date | string | null
  disbursementCount: number
  paidInstallments: number
  createdAt: Date | string | null
}

export type RevertDecision = { loanId: string; action: 'revert' | 'skip'; reason: string }

export function isAutoGenerator(g: string | null | undefined): boolean {
  return AUTO_GENERATORS.includes(String(g ?? '') as (typeof AUTO_GENERATORS)[number])
}

export function classifyAutoApproved(row: AutoApprovedRow): RevertDecision {
  const skip = (reason: string): RevertDecision => ({ loanId: row.loanId, action: 'skip', reason })
  if (!isAutoGenerator(row.generatedBy)) return skip('No fue aprobado autom\u00e1ticamente (lo aprob\u00f3 una persona).')
  if (row.loanStatus !== 'approved') return skip(`Estado ${row.loanStatus}: no est\u00e1 solo aprobado.`)
  if (row.acceptedAt) return skip('El cliente ya firm\u00f3 el contrato: requiere decisi\u00f3n de Angel/Finanzas.')
  if (row.disbursementCount > 0) return skip('Tiene desembolso registrado.')
  if (row.paidInstallments > 0) return skip('Tiene cuotas pagadas.')
  return { loanId: row.loanId, action: 'revert', reason: 'Aprobado por score sin firma, sin desembolso ni pagos.' }
}

export function planRevert(rows: AutoApprovedRow[]) {
  const decisions = rows.map((r) => ({ row: r, ...classifyAutoApproved(r) }))
  const revert = decisions.filter((d) => d.action === 'revert')
  const skip = decisions.filter((d) => d.action === 'skip')
  return {
    total: rows.length,
    toRevert: revert.length,
    skipped: skip.length,
    byGenerator: rows.reduce<Record<string, number>>((acc, r) => {
      const k = r.generatedBy ?? 'desconocido'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {}),
    decisions,
  }
}

export function planToCsv(plan: ReturnType<typeof planRevert>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['loanId', 'userId', 'accion', 'motivo', 'generadoPor', 'monto', 'score', 'estadoContrato', 'firmadoEn']
  const lines = plan.decisions.map((d) =>
    [d.row.loanId, d.row.userId, d.action, d.reason, d.row.generatedBy, d.row.principal, d.row.scoreAtApproval, d.row.contractStatus, d.row.acceptedAt]
      .map(esc)
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}