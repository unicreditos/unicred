import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { profile, user as userTable, walletAccount, walletMovement } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { WalletError } from '@/lib/wallet/errors'
import { centsOf, formatMoney, fromCents } from '@/lib/money'
import { buildWalletAlias, buildWalletCvu, parseWalletDestination } from '@/lib/wallet/cvu'

/**
 * Libro mayor de la billetera. Mismas tablas y convenciones que `unicred` (`wallet_account`, `wallet_movement`):
 * `direction` = credit | debit, `balanceAfter` en cada asiento, y `externalId` único para que un mismo hecho no
 * se acredite dos veces. Todo el dinero se maneja en CENTAVOS enteros; el saldo se actualiza con aritmética de la
 * base (no con números de punto flotante) y los débitos llevan la condición `balance >= monto` en el propio UPDATE,
 * así el saldo nunca queda negativo aunque dos pedidos lleguen a la vez.
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type WalletRow = typeof walletAccount.$inferSelect

// Los helpers puros y el error de negocio viven en módulos aparte (usables desde el navegador); se re-exportan acá.
export { centsOf, formatMoney, fromCents, WalletError }

export const MIN_TRANSFER_CENTS = 100 // $1
export const MAX_TRANSFER_CENTS = 1_000_000_000 // $10.000.000
export const MIN_PAYOUT_CENTS = 10_000 // $100

export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  if (!Number.isFinite(n)) throw new WalletError('Ingresá un importe válido.')
  return Math.round(n * 100)
}

export function assertAmount(cents: number, min = MIN_TRANSFER_CENTS, max = MAX_TRANSFER_CENTS) {
  if (!Number.isInteger(cents) || cents < min || cents > max) {
    throw new WalletError(
      `El importe tiene que estar entre $${(min / 100).toLocaleString('es-AR')} y $${(max / 100).toLocaleString('es-AR')}.`,
    )
  }
}

export function shortRef(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

/* ------------------------------- Alta ---------------------------------- */

/** Crea la billetera de la persona si no existe (CVU y alias deterministas, iguales a los de `unicred`). */
export async function ensureWallet(userId: string): Promise<WalletRow> {
  const [existing] = await db.select().from(walletAccount).where(eq(walletAccount.userId, userId)).limit(1)
  if (existing) return existing

  const [usr] = await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  if (!usr) throw new WalletError('No encontramos a esa persona.')
  const [prof] = await db.select({ cuil: profile.cuil, dni: profile.dni }).from(profile).where(eq(profile.userId, userId)).limit(1)
  const now = new Date()
  const taxId = (prof?.cuil || prof?.dni || '').replace(/\D/g, '') || null

  await db
    .insert(walletAccount)
    .values({
      id: crypto.randomUUID(),
      userId,
      status: 'active',
      cvu: buildWalletCvu(userId),
      alias: buildWalletAlias(userId),
      holderName: usr.name,
      taxId,
      balance: '0.00',
      currency: 'ARS',
      provider: 'unicred',
      liveAttempt: { provider: 'unicred', native: true },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: walletAccount.userId })

  const [created] = await db.select().from(walletAccount).where(eq(walletAccount.userId, userId)).limit(1)
  if (!created) throw new WalletError('No pudimos crear la billetera.')
  return created
}

/** Crea las billeteras que falten (una por persona). Devuelve cuántas creó. */
export async function ensureAllWallets(): Promise<{ created: number }> {
  const missing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(sql`not exists (select 1 from wallet_account w where w."userId" = ${userTable.id})`)
  let created = 0
  for (const row of missing) {
    await ensureWallet(row.id)
    created += 1
  }
  return { created }
}

/* ------------------------------ Asientos ------------------------------- */

/** Bloquea las billeteras indicadas en orden determinista (evita interbloqueos entre dos transferencias cruzadas). */
export async function lockWallets(tx: Tx, ids: string[]): Promise<Map<string, WalletRow>> {
  const rows = await tx
    .select()
    .from(walletAccount)
    .where(inArray(walletAccount.id, [...new Set(ids)]))
    .orderBy(asc(walletAccount.id))
    .for('update')
  return new Map(rows.map((r) => [r.id, r]))
}

export type MovementInput = {
  direction: 'credit' | 'debit'
  kind: string
  cents: number
  externalId?: string | null
  reference?: string | null
  notes?: string | null
  counterpartyUserId?: string | null
  payoutId?: string | null
  paymentId?: string | null
  /** Para devoluciones y ajustes de administración sobre una billetera bloqueada. */
  allowBlocked?: boolean
}

export type MovementResult = { duplicate: boolean; balanceAfterCents: number; movementId: string }

/** Registra un asiento. La billetera debe estar bloqueada por la transacción (`lockWallets`). */
export async function postMovement(tx: Tx, wallet: WalletRow, input: MovementInput): Promise<MovementResult> {
  if (!Number.isInteger(input.cents) || input.cents <= 0) throw new WalletError('Importe inválido.')

  if (input.externalId) {
    const [dup] = await tx
      .select({ id: walletMovement.id, balanceAfter: walletMovement.balanceAfter })
      .from(walletMovement)
      .where(eq(walletMovement.externalId, input.externalId))
      .limit(1)
    if (dup) return { duplicate: true, balanceAfterCents: centsOf(dup.balanceAfter), movementId: dup.id }
  }
  if (wallet.status !== 'active' && !input.allowBlocked) {
    throw new WalletError('La billetera está bloqueada. Contactá a soporte.')
  }

  const amount = fromCents(input.cents)
  const now = new Date()
  const updated =
    input.direction === 'debit'
      ? await tx
          .update(walletAccount)
          .set({ balance: sql`${walletAccount.balance} - ${amount}::numeric`, updatedAt: now })
          .where(and(eq(walletAccount.id, wallet.id), sql`${walletAccount.balance} >= ${amount}::numeric`))
          .returning({ balance: walletAccount.balance })
      : await tx
          .update(walletAccount)
          .set({ balance: sql`${walletAccount.balance} + ${amount}::numeric`, updatedAt: now })
          .where(eq(walletAccount.id, wallet.id))
          .returning({ balance: walletAccount.balance })

  if (!updated[0]) throw new WalletError('Saldo insuficiente.')

  const movementId = newId('wmov')
  await tx.insert(walletMovement).values({
    id: movementId,
    walletId: wallet.id,
    userId: wallet.userId,
    direction: input.direction,
    kind: input.kind,
    amount,
    balanceAfter: updated[0].balance,
    paymentId: input.paymentId ?? null,
    payoutId: input.payoutId ?? null,
    counterpartyUserId: input.counterpartyUserId ?? null,
    externalId: input.externalId ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  })
  return { duplicate: false, balanceAfterCents: centsOf(updated[0].balance), movementId }
}

/* --------------------------- Transferencia interna --------------------- */

export async function findWalletByDestination(raw: string): Promise<WalletRow | null> {
  const dest = parseWalletDestination(raw)
  if (dest.kind === 'cbu') return null // un CBU bancario nunca es una billetera interna
  const [row] = await db
    .select()
    .from(walletAccount)
    .where(dest.kind === 'alias' ? eq(walletAccount.alias, dest.value) : eq(walletAccount.cvu, dest.value))
    .limit(1)
  return row ?? null
}

export type TransferResult = { reference: string; toAlias: string; toHolder: string | null; balanceAfterCents: number }

/** Transferencia entre dos billeteras UNICRÉDITOS: instantánea, atómica e idempotente por referencia. */
export async function transferInternal(input: {
  fromUserId: string
  to: WalletRow
  cents: number
  concept?: string
  channel: 'transfer' | 'qr'
  reference?: string
}): Promise<TransferResult> {
  assertAmount(input.cents)
  const from = await ensureWallet(input.fromUserId)
  if (from.id === input.to.id) throw new WalletError('No podés transferirte a tu propia billetera.')

  const reference = input.reference ?? shortRef(input.channel === 'qr' ? 'UC-QR' : 'UC-P2P')
  const note = (input.concept ?? '').trim().slice(0, 80)
  const label = input.channel === 'qr' ? 'Pago con QR' : 'Transferencia'

  return db.transaction(async (tx) => {
    const locked = await lockWallets(tx, [from.id, input.to.id])
    const a = locked.get(from.id)
    const b = locked.get(input.to.id)
    if (!a || !b) throw new WalletError('Billetera no encontrada.')
    if (b.status !== 'active') throw new WalletError('La billetera de destino no puede recibir dinero en este momento.')

    const out = await postMovement(tx, a, {
      direction: 'debit',
      kind: 'p2p_out',
      cents: input.cents,
      counterpartyUserId: b.userId,
      externalId: `p2p-out-${reference}`,
      reference,
      notes: `${label} a @${b.alias}${note ? ` · ${note}` : ''}`,
    })
    if (!out.duplicate) {
      await postMovement(tx, b, {
        direction: 'credit',
        kind: 'p2p_in',
        cents: input.cents,
        counterpartyUserId: a.userId,
        externalId: `p2p-in-${reference}`,
        reference,
        notes: `${label} de @${a.alias}${note ? ` · ${note}` : ''}`,
      })
    }
    return { reference, toAlias: b.alias, toHolder: b.holderName, balanceAfterCents: out.balanceAfterCents }
  })
}
