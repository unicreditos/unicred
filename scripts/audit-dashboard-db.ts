/**
 * Lectura remota de Neon para auditar el dashboard. No imprime secretos.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

async function main() {
  const { db, pool } = await import('@/lib/db')
  const {
    user,
    profile,
    loan,
    installment,
    kycVerification,
    bankAccount,
    payment,
    paymentReceipt,
    loanContract,
    disbursement,
    bcraCheck,
    diditSession,
  } = await import('@/lib/db/schema')
  const { sql, desc, eq } = await import('drizzle-orm')

  const countsRes: any = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM "user") AS users,
      (SELECT count(*)::int FROM profile) AS profiles,
      (SELECT count(*)::int FROM profile WHERE role = 'admin') AS admins,
      (SELECT count(*)::int FROM profile WHERE role = 'customer') AS customers,
      (SELECT count(*)::int FROM loan) AS loans,
      (SELECT count(*)::int FROM installment) AS installments,
      (SELECT count(*)::int FROM installment WHERE status <> 'paid') AS unpaid,
      (SELECT count(*)::int FROM kyc_verification) AS kyc,
      (SELECT count(*)::int FROM kyc_verification WHERE status = 'approved') AS kyc_ok,
      (SELECT count(*)::int FROM bank_account) AS banks,
      (SELECT count(*)::int FROM payment) AS payments,
      (SELECT count(*)::int FROM payment_receipt) AS receipts,
      (SELECT count(*)::int FROM loan_contract) AS contracts,
      (SELECT count(*)::int FROM disbursement) AS disbursements,
      (SELECT count(*)::int FROM didit_session) AS didit
  `)
  const counts = countsRes.rows?.[0] ?? countsRes[0] ?? countsRes

  const admins = await db
    .select({ email: user.email, name: user.name, role: profile.role, kyc: profile.kycStatus })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.role, 'admin'))
    .limit(20)

  const sample = await db
    .select({
      email: user.email,
      name: user.name,
      role: profile.role,
      kyc: profile.kycStatus,
      userId: user.id,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.role, 'customer'))
    .orderBy(desc(user.createdAt))
    .limit(8)

  const loanRows = await db
    .select({
      id: loan.id,
      userId: loan.userId,
      status: loan.status,
      principal: loan.principal,
      term: loan.term,
    })
    .from(loan)
    .orderBy(desc(loan.createdAt))
    .limit(12)

  const orphansRes: any = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM loan l WHERE NOT EXISTS (SELECT 1 FROM installment i WHERE i."loanId" = l.id)) AS loans_sin_cuotas,
      (SELECT count(*)::int FROM loan l WHERE l.status IN ('approved','active') AND NOT EXISTS (SELECT 1 FROM disbursement d WHERE d."loanId" = l.id)) AS approved_sin_desembolso,
      (SELECT count(*)::int FROM kyc_verification k WHERE k.provider = 'didit' AND (k."dniFrontImageUrl" IS NULL OR k."dniFrontImageUrl" = '')) AS didit_sin_url_frente,
      (SELECT count(*)::int FROM profile p WHERE p.role = 'customer' AND NOT EXISTS (SELECT 1 FROM kyc_verification k WHERE k."userId" = p."userId")) AS clientes_sin_kyc
  `)
  const orphans = orphansRes.rows?.[0] ?? orphansRes[0] ?? orphansRes

  console.log('COUNTS', counts)
  console.log('ADMINS', admins.map((a) => ({ email: a.email, kyc: a.kyc })))
  console.log('CUSTOMERS', sample.map((s) => ({ email: s.email, kyc: s.kyc, id: s.userId.slice(0, 8) })))
  console.log('LOANS', loanRows)
  console.log('ORPHANS', orphans)

  const usersRes: any = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.role AS user_role, p.role AS profile_role, p."kycStatus",
           p.cuil, p.dni, p.phone, p."monthlyIncome", p."creditScore",
           (SELECT count(*) FROM loan l WHERE l."userId" = u.id) AS loans,
           (SELECT count(*) FROM installment i WHERE i."userId" = u.id AND i.status <> 'paid') AS unpaid,
           (SELECT count(*) FROM installment i WHERE i."userId" = u.id AND i.status = 'overdue') AS overdue,
           (SELECT coalesce(sum(i.amount::numeric),0) FROM installment i WHERE i."userId" = u.id AND i.status NOT IN ('paid','cancelled')) AS saldo,
           (SELECT count(*) FROM bank_account b WHERE b."userId" = u.id AND b."isActive" = true) AS banks,
           (SELECT count(*) FROM payment pay WHERE pay."userId" = u.id) AS payments,
           (SELECT count(*) FROM payment_receipt pr WHERE pr."userId" = u.id) AS receipts,
           (SELECT count(*) FROM loan_contract c WHERE c."userId" = u.id) AS contracts,
           (SELECT count(*) FROM disbursement d WHERE d."userId" = u.id) AS disbursements,
           (SELECT k.status FROM kyc_verification k WHERE k."userId" = u.id LIMIT 1) AS kyc_row
    FROM "user" u
    LEFT JOIN profile p ON p."userId" = u.id
    ORDER BY u."createdAt" DESC
  `)
  console.log('USERS', usersRes.rows ?? usersRes)

  const statusRes: any = await db.execute(sql`
    SELECT 'installment' AS t, status, count(*)::int AS n FROM installment GROUP BY status
    UNION ALL
    SELECT 'payment', status, count(*)::int FROM payment GROUP BY status
    UNION ALL
    SELECT 'loan', status, count(*)::int FROM loan GROUP BY status
    UNION ALL
    SELECT 'kyc', status, count(*)::int FROM kyc_verification GROUP BY status
    UNION ALL
    SELECT 'contract', status, count(*)::int FROM loan_contract GROUP BY status
    UNION ALL
    SELECT 'disbursement', status, count(*)::int FROM disbursement GROUP BY status
    UNION ALL
    SELECT 'product', CASE WHEN active THEN 'active' ELSE 'inactive' END, count(*)::int FROM loan_product GROUP BY active
  `)
  console.log('STATUSES', statusRes.rows ?? statusRes)

  const profileOrphans: any = await db.execute(sql`
    SELECT p.id, p."userId", p.role FROM profile p
    LEFT JOIN "user" u ON u.id = p."userId"
    WHERE u.id IS NULL
  `)
  console.log('PROFILE_ORPHANS', profileOrphans.rows ?? profileOrphans)

  const kycUsers: any = await db.execute(sql`
    SELECT k.id, k."userId", k.status, k.provider, u.email
    FROM kyc_verification k
    LEFT JOIN "user" u ON u.id = k."userId"
  `)
  console.log('KYC_ROWS', kycUsers.rows ?? kycUsers)

  const diditUsers: any = await db.execute(sql`
    SELECT d."sessionId", d."userId", d.status, u.email
    FROM didit_session d
    LEFT JOIN "user" u ON u.id = d."userId"
    ORDER BY d."updatedAt" DESC
  `)
  console.log('DIDIT', diditUsers.rows ?? diditUsers)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
