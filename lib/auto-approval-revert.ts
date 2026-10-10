/**
 * Planificador PURO (sin base de datos) para devolver a "pendiente" (en evaluacion) los creditos
 * que quedaron aprobados automaticamente por puntaje, sin decision de una persona.
 *
 * Marca de "aprobado automaticamente": loan_contract.generatedBy IN AUTO_GENERATORS. Los flujos
 * automaticos (app/actions/loans.ts, lib/mobile/ops.ts, app/actions/merchant.ts) emiten el contrato
 * en el mismo alta con ese origen; las aprobaciones humanas lo emiten con el id del admin.
 *
 * Conservador: solo se mueve un credito 'approved' sin contrato firmado, sin desembolsos de ningun
 * tipo, sin cuotas y sin pagos. Todo lo demas se informa aparte y NO se toca sin decision de Angel.
 * El contrato, las cuotas, los desembolsos, los pagos y los documentos NUNCA se modifican.
 */
export const AUTO_GENERATORS = ['auto_score', 'mobile_auto', 'merchant_sale', 'online_consumo'] as const

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
  installmentCount?: number
  paymentCount?: number
  createdAt: Date | string | null
}

export type SkipCode = 'human' | 'not_approved' | 'signed' | 'disbursed' | 'paid_or_installments'
export type RevertDecision = { loanId: string; action: 'revert' | 'skip'; code: 'revert' | SkipCode; reason: string }

export function isAutoGenerator(g: string | null | undefined): boolean {
  return AUTO_GENERATORS.includes(String(g ?? '') as (typeof AUTO_GENERATORS)[number])
}

/** Id enmascarado para informes: solo los ultimos 6 caracteres. */
export function maskId(id: string): string {
  return `\u2026${String(id).slice(-6)}`
}

export function classifyAutoApproved(row: AutoApprovedRow): RevertDecision {
  const skip = (code: SkipCode, reason: string): RevertDecision => ({ loanId: row.loanId, action: 'skip', code, reason })
  if (!isAutoGenerator(row.generatedBy)) return skip('human', 'No fue aprobado autom\u00e1ticamente (lo aprob\u00f3 una persona).')
  if (row.loanStatus !== 'approved') return skip('not_approved', `Estado ${row.loanStatus}: no est\u00e1 solo aprobado; requiere decisi\u00f3n de Angel.`)
  if (row.acceptedAt) return skip('signed', 'El cliente ya firm\u00f3 el contrato: requiere decisi\u00f3n de Angel/Finanzas.')
  if (row.disbursementCount > 0) return skip('disbursed', 'Tiene desembolso registrado: no se mueve.')
  if (row.paidInstallments > 0 || (row.installmentCount ?? 0) > 0 || (row.paymentCount ?? 0) > 0) {
    return skip('paid_or_installments', 'Tiene cuotas o pagos: no se mueve.')
  }
  return { loanId: row.loanId, action: 'revert', code: 'revert', reason: 'Aprobado por puntaje sin firma, sin desembolso, cuotas ni pagos.' }
}

export function planRevert(rows: AutoApprovedRow[]) {
  const decisions = rows.map((r) => ({ row: r, ...classifyAutoApproved(r) }))
  const auto = decisions.filter((d) => d.code !== 'human')
  const count = (f: (r: AutoApprovedRow) => string) =>
    auto.reduce<Record<string, number>>((acc, d) => {
      const k = f(d.row)
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  return {
    total: rows.length,
    autoTotal: auto.length,
    toRevert: decisions.filter((d) => d.action === 'revert').length,
    skipped: decisions.filter((d) => d.action === 'skip').length,
    byGenerator: count((r) => r.generatedBy ?? 'desconocido'),
    byState: count((r) => r.loanStatus),
    bySkipCode: auto.filter((d) => d.action === 'skip').reduce<Record<string, number>>((acc, d) => {
      acc[d.code] = (acc[d.code] ?? 0) + 1
      return acc
    }, {}),
    decisions,
  }
}

export function arDayOf(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d)
}

/** CSV enmascarado: sin nombres, CUIL ni ids de usuario. Solo id corto, estado, fecha y monto. */
export function planToCsv(plan: ReturnType<typeof planRevert>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['credito', 'estado', 'fecha_ar', 'monto', 'accion', 'codigo', 'motivo']
  const lines = plan.decisions
    .filter((d) => d.code !== 'human')
    .map((d) => [maskId(d.row.loanId), d.row.loanStatus, arDayOf(d.row.createdAt), d.row.principal, d.action, d.code, d.reason].map(esc).join(','))
  return [head.join(','), ...lines].join('\n')
}

export const CONFIRM_ENV = 'REVERT_AUTO_APPROVALS_CONFIRM'
export const CONFIRM_VALUE = 'SI_REVERTIR_AUTOAPROBADOS'
export const BACKUP_TABLE = 'loan_autoapproval_revert_backup'