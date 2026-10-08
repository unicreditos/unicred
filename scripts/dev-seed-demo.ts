/**
 * Datos de ejemplo para probar los paneles (admin y cliente) sin tocar datos reales.
 * Solo corre contra una base LOCAL (127.0.0.1 / localhost): se niega a escribir en cualquier otra.
 *
 *   1) Levantá el Postgres local:   docker start unicred-pg-dev
 *   2) Cuentas QA:                  DATABASE_URL=postgres://postgres:dev@127.0.0.1:5433/unicred npx tsx scripts/qa-seed-audit-accounts.ts --yes
 *   3) Datos de ejemplo:            DATABASE_URL=postgres://postgres:dev@127.0.0.1:5433/unicred npx tsx scripts/dev-seed-demo.ts
 *
 * Es idempotente: borra y recrea solo lo que sembró (ids con prefijo "demo_").
 */
import { eq, like } from 'drizzle-orm'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    // sin URL válida
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    console.error(`Me niego: DATABASE_URL apunta a "${host || 'nada'}", no a una base local.`)
    process.exit(1)
  }

  const { db, pool } = await import('@/lib/db')
  const s = await import('@/lib/db/schema')

  const [persona] = await db.select().from(s.user).where(eq(s.user.email, 'qa-persona-audit@unicreditos.com')).limit(1)
  if (!persona) {
    console.error('Falta la cuenta qa-persona-audit. Corré antes scripts/qa-seed-audit-accounts.ts --yes')
    process.exit(1)
  }
  const uid = persona.id

  // Limpieza de corridas anteriores (las filas hijas caen por cascade).
  await db.delete(s.loan).where(like(s.loan.id, 'demo_%'))
  await db.delete(s.payment).where(like(s.payment.id, 'demo_%'))

  const day = 86_400_000
  const now = Date.now()
  const at = (days: number) => new Date(now + days * day)
  const principal = 100_000
  const term = 12
  const cuota = 12_927.78

  // Identidad Didit aprobada: sin esto el sistema no deja aprobar créditos.
  await db
    .insert(s.kycVerification)
    .values({
      id: 'demo_kyc_persona',
      userId: uid,
      provider: 'didit',
      status: 'approved',
      verificationLevel: 'biometric',
      dniNumber: '11111111',
      reviewedAt: at(-30),
    } as never)
    .onConflictDoNothing()

  const [account] = await db
    .insert(s.bankAccount)
    .values({
      id: 'demo_bank_persona',
      userId: uid,
      bankName: 'Banco Macro',
      accountType: 'cbu',
      cbu: '2850590940090418135201',
      alias: 'qa.persona.demo',
      holderName: 'QA Auditoria Persona',
      holderCuil: '20111111112',
      isVerified: true,
      isPrimary: true,
      isActive: true,
    } as never)
    .onConflictDoNothing()
    .returning()
  const bankId = account?.id ?? 'demo_bank_persona'

  const base = { userId: uid, principal: String(principal), term, monthlyRate: '7.500', tna: '90.000', tea: '138.200', cft: '167.200', installmentAmount: String(cuota), totalAmount: String(cuota * term) }

  // L1: vigente, 2 cuotas pagas, contrato firmado, desembolso acreditado.
  await db.insert(s.loan).values({ id: 'demo_loan_active', ...base, status: 'active', purpose: 'Consumo', disbursedAt: at(-70) } as never)
  for (let n = 1; n <= term; n++) {
    await db.insert(s.installment).values({
      id: `demo_inst_${n}`,
      loanId: 'demo_loan_active',
      userId: uid,
      number: n,
      amount: String(cuota),
      dueDate: at(-70 + 30 * n),
      status: n <= 2 ? 'paid' : n === 3 ? 'overdue' : 'pending',
      paidAt: n <= 2 ? at(-70 + 30 * n - 2) : null,
    } as never)
  }
  await db.insert(s.loanContract).values({ id: 'demo_contract_active', loanId: 'demo_loan_active', userId: uid, status: 'accepted', acceptedAt: at(-71) } as never)
  await db.insert(s.disbursement).values({ id: 'demo_disb_active', receiptNumber: 'DES-DEMO-0001', loanId: 'demo_loan_active', userId: uid, bankAccountId: bankId, amount: String(principal), status: 'credited', creditedAt: at(-70) } as never)

  // L2: en revisión (para probar aprobar / rechazar).
  await db.insert(s.loan).values({ id: 'demo_loan_pending', ...base, principal: '250000', status: 'pending', purpose: 'Refacción' } as never)
  // L3: aprobado con desembolso pendiente (para probar acreditar / fallido).
  await db.insert(s.loan).values({ id: 'demo_loan_approved', ...base, principal: '150000', status: 'approved', purpose: 'Capital de trabajo' } as never)
  await db.insert(s.loanContract).values({ id: 'demo_contract_approved', loanId: 'demo_loan_approved', userId: uid, status: 'accepted', acceptedAt: at(-1) } as never)
  await db.insert(s.disbursement).values({ id: 'demo_disb_approved', receiptNumber: 'DES-DEMO-0002', loanId: 'demo_loan_approved', userId: uid, bankAccountId: bankId, amount: '150000', status: 'pending' } as never)

  // Pagos: uno acreditado y una transferencia por conciliar (cuota 3, vencida).
  await db.insert(s.payment).values({ id: 'demo_pay_ok', userId: uid, loanId: 'demo_loan_active', installmentId: 'demo_inst_2', amount: String(cuota), method: 'mercadopago', status: 'paid', paidAt: at(-12) } as never)
  await db.insert(s.payment).values({ id: 'demo_pay_transfer', userId: uid, loanId: 'demo_loan_active', installmentId: 'demo_inst_3', amount: String(cuota), method: 'transferencia_bancaria', status: 'pending_review', referenceNumber: 'DEMO-TRF-001', notes: 'Transferencia informada por el cliente' } as never)

  await db.insert(s.bcraCheck).values({ id: 'demo_bcra', userId: uid, cuil: '20111111112', worstSituation: 1, entitiesCount: 2, totalDebt: '486000', computedScore: 720, consultedAt: at(-6) } as never).onConflictDoNothing()

  console.log('Datos de ejemplo listos: 3 créditos (vigente, en revisión, aprobado), cuotas, 2 pagos, 2 desembolsos.')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
