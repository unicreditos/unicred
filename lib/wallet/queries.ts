import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cleanSearch } from '@/lib/search'
import { profile, user as userTable, walletAccount, walletMovement, walletPayout } from '@/lib/db/schema'
import { POSTED_SQL } from '@/lib/wallet/display'
import { centsOf, ensureWallet, fromCents } from '@/lib/wallet/ledger'

export const MOVEMENTS_PAGE_SIZE = 25

/** Los asientos viejos de `unicred` usan `in` / `out`; los actuales, credit / debit. */
export function isCredit(direction: string) {
  return direction === 'credit' || direction === 'in'
}

export const MOVEMENT_LABELS: Record<string, string> = {
  p2p_in: 'Transferencia recibida',
  p2p_out: 'Transferencia enviada',
  treasury_payout: 'Retiro a cuenta bancaria',
  payout_refund: 'Devolución de retiro',
  loan_disbursement: 'Desembolso de crédito',
  admin_adjustment: 'Ajuste de administración',
  pay_installment: 'Pago de cuota',
  outbound_transfer: 'Transferencia a banco',
  load: 'Ingreso',
  service_payment: 'Pago de servicio',
  service_bill: 'Pago de servicio',
  service_recharge: 'Recarga',
  loan_withdrawal: 'Devolución del préstamo (arrepentimiento)',
  mp_qr_in: 'Cobro con QR',
  mp_qr_reversal: 'Devolución de un cobro con QR',
}

export function movementLabel(kind: string) {
  return MOVEMENT_LABELS[kind] ?? kind.replace(/_/g, ' ')
}

export async function getWalletOverview(userId: string) {
  const wallet = await ensureWallet(userId)
  const [recent, payouts, totals] = await Promise.all([
    db.select().from(walletMovement).where(eq(walletMovement.walletId, wallet.id)).orderBy(desc(walletMovement.createdAt)).limit(10),
    db.select().from(walletPayout).where(eq(walletPayout.walletId, wallet.id)).orderBy(desc(walletPayout.createdAt)).limit(10),
    db
      .select({
        credits: sql<string>`coalesce(sum(case when direction in ('credit','in') and ${sql.raw(POSTED_SQL)} then amount else 0 end),0)::text`,
        debits: sql<string>`coalesce(sum(case when direction in ('debit','out') and ${sql.raw(POSTED_SQL)} then amount else 0 end),0)::text`,
      })
      .from(walletMovement)
      .where(eq(walletMovement.walletId, wallet.id)),
  ])
  const heldCents = payouts.filter((p) => p.status === 'queued').reduce((acc, p) => acc + centsOf(p.amount), 0)
  return { wallet, recent, payouts, totals: totals[0], held: fromCents(heldCents) }
}

export async function listMovements(walletId: string, page: number, kind?: string) {
  const where = and(eq(walletMovement.walletId, walletId), kind ? eq(walletMovement.kind, kind) : undefined)
  const [rows, [total]] = await Promise.all([
    db.select().from(walletMovement).where(where).orderBy(desc(walletMovement.createdAt)).limit(MOVEMENTS_PAGE_SIZE).offset((Math.max(1, page) - 1) * MOVEMENTS_PAGE_SIZE),
    db.select({ n: count() }).from(walletMovement).where(where),
  ])
  return { rows, total: Number(total?.n ?? 0), pageSize: MOVEMENTS_PAGE_SIZE }
}

/** Grupos de operaciones para filtrar los movimientos: lo que una persona reconoce, no el tipo técnico del asiento. */
export const MOVEMENT_GROUPS = [
  { key: 'transferencias', label: 'Transferencias', kinds: ['p2p_in', 'p2p_out', 'outbound_transfer'] },
  { key: 'qr', label: 'Cobros con QR', kinds: ['mp_qr_in', 'mp_qr_reversal'] },
  { key: 'retiros', label: 'Retiros a bancos', kinds: ['treasury_payout', 'payout_refund'] },
  { key: 'creditos', label: 'Créditos y cuotas', kinds: ['loan_disbursement', 'pay_installment', 'loan_withdrawal'] },
  { key: 'servicios', label: 'Servicios y recargas', kinds: ['service_payment', 'service_bill', 'service_recharge'] },
  { key: 'ajustes', label: 'Ajustes e ingresos', kinds: ['admin_adjustment', 'load'] },
] as const

export type MovementFilters = {
  group?: string
  dir?: 'in' | 'out'
  from?: Date
  /** Fecha final inclusive (se toma hasta el fin de ese día). */
  to?: Date
  q?: string
}

/** "2026-10-09" → inicio de ese día en hora argentina; inválida → undefined. */
export function parseDay(value: string | null | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const d = new Date(`${value}T00:00:00-03:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function movementWhere(walletId: string, f: MovementFilters = {}) {
  const group = MOVEMENT_GROUPS.find((g) => g.key === f.group)
  const q = cleanSearch(f.q)
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  return and(
    eq(walletMovement.walletId, walletId),
    group ? inArray(walletMovement.kind, [...group.kinds]) : undefined,
    f.dir === 'in' ? inArray(walletMovement.direction, ['credit', 'in']) : f.dir === 'out' ? inArray(walletMovement.direction, ['debit', 'out']) : undefined,
    f.from ? sql`${walletMovement.createdAt} >= ${f.from}` : undefined,
    f.to ? sql`${walletMovement.createdAt} < ${new Date(f.to.getTime() + 86_400_000)}` : undefined,
    like ? or(ilike(walletMovement.reference, like), ilike(walletMovement.notes, like)) : undefined,
  )
}

/** Movimientos con filtros (grupo, ingresos/egresos, período y texto), paginados. */
export async function listMovementsFiltered(walletId: string, page: number, f: MovementFilters) {
  const where = movementWhere(walletId, f)
  const [rows, [total]] = await Promise.all([
    db.select().from(walletMovement).where(where).orderBy(desc(walletMovement.createdAt)).limit(MOVEMENTS_PAGE_SIZE).offset((Math.max(1, page) - 1) * MOVEMENTS_PAGE_SIZE),
    db.select({ n: count() }).from(walletMovement).where(where),
  ])
  return { rows, total: Number(total?.n ?? 0), pageSize: MOVEMENTS_PAGE_SIZE }
}

/** Los mismos filtros, sin paginar (para exportar), con tope. */
export async function exportMovementsFiltered(walletId: string, f: MovementFilters) {
  return db.select().from(walletMovement).where(movementWhere(walletId, f)).orderBy(walletMovement.createdAt).limit(5000)
}

/** Un movimiento de la billetera de la persona (null si no existe o es de otra). */
export async function getMovement(walletId: string, id: string) {
  const [row] = await db
    .select()
    .from(walletMovement)
    .where(and(eq(walletMovement.walletId, walletId), eq(walletMovement.id, id)))
    .limit(1)
  return row ?? null
}

/** Movimientos de un período para el resumen imprimible (acotado). */
export async function movementsBetween(walletId: string, from: Date, to: Date) {
  return db
    .select()
    .from(walletMovement)
    .where(and(eq(walletMovement.walletId, walletId), sql`${walletMovement.createdAt} >= ${from} and ${walletMovement.createdAt} < ${to}`))
    .orderBy(walletMovement.createdAt)
    .limit(2000)
}

/** Saldo al inicio de un período: suma de lo acreditado antes de esa fecha (no depende del saldo guardado en cada asiento). */
export async function balanceBefore(walletId: string, before: Date) {
  const [row] = await db
    .select({ net: sql<string>`coalesce(sum(case when direction in ('credit','in') then amount else -amount end),0)::text` })
    .from(walletMovement)
    .where(and(eq(walletMovement.walletId, walletId), sql`${walletMovement.createdAt} < ${before}`, sql`${sql.raw(POSTED_SQL)}`))
  return centsOf(row?.net ?? 0)
}

/* ------------------------------- Admin --------------------------------- */

export const ADMIN_WALLETS_PAGE_SIZE = 25

export async function listWalletsForAdmin(input: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const filters: SQL[] = []
  if (input.status === 'active' || input.status === 'blocked') filters.push(eq(walletAccount.status, input.status))
  const q = cleanSearch(input.q)
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    const cond = or(ilike(userTable.email, like), ilike(userTable.name, like), ilike(walletAccount.alias, like), ilike(walletAccount.cvu, like), ilike(profile.dni, like))
    if (cond) filters.push(cond)
  }
  const where = filters.length ? and(...filters) : undefined
  const joined = () =>
    db
      .select({
        wallet: walletAccount,
        name: userTable.name,
        email: userTable.email,
        kycStatus: profile.kycStatus,
      })
      .from(walletAccount)
      .innerJoin(userTable, eq(userTable.id, walletAccount.userId))
      .leftJoin(profile, eq(profile.userId, walletAccount.userId))
  const [rows, [agg], [missing]] = await Promise.all([
    joined().where(where).orderBy(desc(walletAccount.balance)).limit(ADMIN_WALLETS_PAGE_SIZE).offset((page - 1) * ADMIN_WALLETS_PAGE_SIZE),
    db
      .select({
        n: count(),
        total: sql<string>`coalesce(sum(${walletAccount.balance}),0)::text`,
        blocked: sql<number>`count(*) filter (where ${walletAccount.status} <> 'active')::int`,
      })
      .from(walletAccount)
      .innerJoin(userTable, eq(userTable.id, walletAccount.userId))
      .leftJoin(profile, eq(profile.userId, walletAccount.userId))
      .where(where),
    db.select({ n: sql<number>`count(*)::int` }).from(userTable).where(sql`not exists (select 1 from wallet_account w where w."userId" = ${userTable.id})`),
  ])
  const [held] = await db
    .select({ total: sql<string>`coalesce(sum(amount),0)::text`, n: sql<number>`count(*)::int` })
    .from(walletPayout)
    .where(eq(walletPayout.status, 'queued'))
  return {
    rows,
    total: Number(agg?.n ?? 0),
    balanceTotal: agg?.total ?? '0',
    blocked: Number(agg?.blocked ?? 0),
    withoutWallet: Number(missing?.n ?? 0),
    pendingPayoutsTotal: held?.total ?? '0',
    pendingPayoutsCount: Number(held?.n ?? 0),
    page,
    pageSize: ADMIN_WALLETS_PAGE_SIZE,
  }
}

export async function getWalletForAdmin(userId: string) {
  const [row] = await db
    .select({ wallet: walletAccount, name: userTable.name, email: userTable.email, kycStatus: profile.kycStatus, cuil: profile.cuil })
    .from(userTable)
    .leftJoin(walletAccount, eq(walletAccount.userId, userTable.id))
    .leftJoin(profile, eq(profile.userId, userTable.id))
    .where(eq(userTable.id, userId))
    .limit(1)
  if (!row) return null
  let recent: (typeof walletMovement.$inferSelect)[] = []
  let payouts: (typeof walletPayout.$inferSelect)[] = []
  let consistent: boolean | null = null
  if (row.wallet) {
    ;[recent, payouts] = await Promise.all([
      db.select().from(walletMovement).where(eq(walletMovement.walletId, row.wallet.id)).orderBy(desc(walletMovement.createdAt)).limit(40),
      db.select().from(walletPayout).where(eq(walletPayout.walletId, row.wallet.id)).orderBy(desc(walletPayout.createdAt)).limit(30),
    ])
    const [sum] = await db
      .select({
        net: sql<string>`coalesce(sum(case when direction in ('credit','in') then amount else -amount end),0)::text`,
      })
      .from(walletMovement)
      .where(and(eq(walletMovement.walletId, row.wallet.id), sql`${sql.raw(POSTED_SQL)}`))
    consistent = centsOf(sum?.net) === centsOf(row.wallet.balance)
  }
  return { ...row, recent, payouts, consistent }
}

export async function payoutOwners(ids: string[]) {
  if (!ids.length) return new Map<string, { name: string; email: string }>()
  const rows = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email }).from(userTable).where(inArray(userTable.id, ids))
  return new Map(rows.map((r) => [r.id, { name: r.name, email: r.email }]))
}

/** Totales para el resumen de administración. */
export async function treasurySummary() {
  const [[w], [p], pending] = await Promise.all([
    db
      .select({ n: count(), total: sql<string>`coalesce(sum(${walletAccount.balance}),0)::text` })
      .from(walletAccount),
    db
      .select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(amount),0)::text` })
      .from(walletPayout)
      .where(eq(walletPayout.status, 'queued')),
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from loan l
       where l.status = 'approved' and l."disbursedAt" is null
         and not exists (select 1 from disbursement d where d."loanId" = l.id and d.status in ('credited','completed'))`),
  ])
  return {
    wallets: Number(w?.n ?? 0),
    balance: w?.total ?? '0',
    payoutsCount: Number(p?.n ?? 0),
    payoutsTotal: p?.total ?? '0',
    pendingDisbursements: Number(pending.rows[0]?.n ?? 0),
  }
}
