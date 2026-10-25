import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cleanSearch } from '@/lib/search'
import { adminAuditLog, kycVerification, profile, user as userTable } from '@/lib/db/schema'

/** Consultas de lectura del backoffice. Cada página que las usa llama antes a requireAdmin(). */

export const ADMIN_PAGE_SIZE = 25

export type AdminVerificationRow = {
  userId: string
  name: string
  email: string
  dni: string | null
  cuil: string | null
  status: string
  rejectionReason: string | null
  updatedAt: Date
}

export async function listVerifications(input: { status?: string; q?: string; page?: number }) {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const filters: SQL[] = []
  if (input.status && ['pending', 'reviewing', 'approved', 'rejected'].includes(input.status)) {
    filters.push(eq(kycVerification.status, input.status))
  }
  const q = cleanSearch(input.q)
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    const cond = or(ilike(userTable.email, like), ilike(userTable.name, like), ilike(profile.dni, like), ilike(profile.cuil, like))
    if (cond) filters.push(cond)
  }
  const where = filters.length ? and(...filters) : undefined

  const base = db
    .select({
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      dni: profile.dni,
      cuil: profile.cuil,
      status: kycVerification.status,
      rejectionReason: kycVerification.rejectionReason,
      updatedAt: kycVerification.updatedAt,
    })
    .from(kycVerification)
    .innerJoin(userTable, eq(userTable.id, kycVerification.userId))
    .leftJoin(profile, eq(profile.userId, kycVerification.userId))

  const [rows, [total]] = await Promise.all([
    base
      .where(where)
      .orderBy(desc(kycVerification.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db
      .select({ n: count() })
      .from(kycVerification)
      .innerJoin(userTable, eq(userTable.id, kycVerification.userId))
      .leftJoin(profile, eq(profile.userId, kycVerification.userId))
      .where(where),
  ])
  return { rows: rows as AdminVerificationRow[], total: Number(total?.n ?? 0), page, pageSize: ADMIN_PAGE_SIZE }
}

export async function verificationCounts() {
  // innerJoin con la cuenta: una verificación sin persona (cuenta borrada) no cuenta como verificada ni rechazada.
  const rows = await db
    .select({ status: kycVerification.status, n: count() })
    .from(kycVerification)
    .innerJoin(userTable, eq(userTable.id, kycVerification.userId))
    .groupBy(kycVerification.status)
  const out: Record<string, number> = { pending: 0, reviewing: 0, approved: 0, rejected: 0 }
  for (const r of rows) out[r.status] = Number(r.n)
  const [users] = await db.select({ n: count() }).from(userTable)
  return {
    pending: out.pending,
    reviewing: out.reviewing,
    approved: out.approved,
    rejected: out.rejected,
    users: Number(users?.n ?? 0),
    // Las que figuran como "Sin verificar" en el listado (iniciaron el trámite y no lo terminaron).
    unverified: out.pending,
  }
}

export async function getVerificationDetail(userId: string) {
  const [row] = await db
    .select({
      user: userTable,
      profile,
      kyc: kycVerification,
    })
    .from(userTable)
    .leftJoin(profile, eq(profile.userId, userTable.id))
    .leftJoin(kycVerification, eq(kycVerification.userId, userTable.id))
    .where(eq(userTable.id, userId))
    .limit(1)
  if (!row) return null
  const trail = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.targetUserId, userId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(30)
  return { ...row, trail }
}

export async function listAuditLog(input: { page?: number; severity?: string }) {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const where =
    input.severity && ['info', 'warning', 'critical'].includes(input.severity)
      ? eq(adminAuditLog.severity, input.severity)
      : sql`true`
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(adminAuditLog).where(where),
  ])
  return { rows, total: Number(total?.n ?? 0), page, pageSize: ADMIN_PAGE_SIZE }
}

export async function listUsersAdmin(input: { q?: string; page?: number }) {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const q = cleanSearch(input.q)
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  const where = like
    ? or(ilike(userTable.email, like), ilike(userTable.name, like), ilike(profile.dni, like), ilike(profile.cuil, like))
    : undefined
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
        banned: userTable.banned,
        createdAt: userTable.createdAt,
        kycStatus: profile.kycStatus,
        dni: profile.dni,
        cuil: profile.cuil,
        balance: sql<string | null>`(select w.balance::text from wallet_account w where w."userId" = ${userTable.id})`,
        loans: sql<number>`(select count(*)::int from loan l where l."userId" = ${userTable.id})`,
      })
      .from(userTable)
      .leftJoin(profile, eq(profile.userId, userTable.id))
      .where(where)
      .orderBy(desc(userTable.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(userTable).leftJoin(profile, eq(profile.userId, userTable.id)).where(where),
  ])
  return { rows, total: Number(total?.n ?? 0), page, pageSize: ADMIN_PAGE_SIZE }
}
