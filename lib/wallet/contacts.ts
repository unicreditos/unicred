import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureAppTables } from '@/lib/db/ensure'
import { savedContact } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { WalletError, findWalletByDestination } from '@/lib/wallet/ledger'

export const MAX_CONTACTS = 50

/** "María Lucía Gómez" → "María L. G." — alcanza para confirmar a quién le mandás sin exponer el nombre completo. */
export function maskHolder(name: string | null | undefined) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Titular de la billetera'
  return parts.map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ')
}

export type ContactRow = { id: string; alias: string | null; cvu: string; name: string; label: string | null; lastUsedAt: string | null }

/** Contactos de la persona: los usados hace poco primero. */
export async function listContacts(userId: string): Promise<ContactRow[]> {
  await ensureAppTables()
  const rows = await db
    .select()
    .from(savedContact)
    .where(eq(savedContact.userId, userId))
    .orderBy(sql`${savedContact.lastUsedAt} desc nulls last`, desc(savedContact.createdAt))
    .limit(MAX_CONTACTS)
  return rows.map((r) => ({ id: r.id, alias: r.alias, cvu: r.cvu, name: r.name, label: r.label, lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null }))
}

/** Guarda la billetera de destino como contacto. Si ya estaba guardada solo se actualiza la etiqueta. */
export async function saveContact(userId: string, input: { destination: string; label?: string | null }) {
  await ensureAppTables()
  const wallet = await findWalletByDestination(input.destination)
  if (!wallet) throw new WalletError('No encontramos una billetera UNICRÉDITOS con ese CVU o alias.')
  if (wallet.userId === userId) throw new WalletError('Esa es tu propia billetera.')
  const label = String(input.label ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) || null

  const [existing] = await db.select({ id: savedContact.id }).from(savedContact).where(and(eq(savedContact.userId, userId), eq(savedContact.cvu, wallet.cvu))).limit(1)
  if (existing) {
    if (label) await db.update(savedContact).set({ label, alias: wallet.alias, name: maskHolder(wallet.holderName) }).where(eq(savedContact.id, existing.id))
    return { id: existing.id, created: false }
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(savedContact).where(eq(savedContact.userId, userId))
  if (n >= MAX_CONTACTS) throw new WalletError(`Podés guardar hasta ${MAX_CONTACTS} contactos. Eliminá alguno para agregar otro.`)
  const id = newId('ctc')
  await db.insert(savedContact).values({ id, userId, cvu: wallet.cvu, alias: wallet.alias, name: maskHolder(wallet.holderName), label }).onConflictDoNothing()
  return { id, created: true }
}

export async function removeContact(userId: string, contactId: string) {
  await ensureAppTables()
  const rows = await db.delete(savedContact).where(and(eq(savedContact.id, contactId), eq(savedContact.userId, userId))).returning({ id: savedContact.id })
  if (rows.length === 0) throw new WalletError('Ese contacto ya no existe.')
}

/** Marca el contacto como usado recién (no falla la transferencia si algo sale mal). */
export async function touchContact(userId: string, cvu: string) {
  try {
    await ensureAppTables()
    await db.update(savedContact).set({ lastUsedAt: new Date() }).where(and(eq(savedContact.userId, userId), eq(savedContact.cvu, cvu)))
  } catch (err) {
    console.warn('[contacts] no se pudo marcar el uso:', (err as Error).message)
  }
}

export async function isSavedContact(userId: string, cvu: string) {
  await ensureAppTables()
  const [row] = await db.select({ id: savedContact.id }).from(savedContact).where(and(eq(savedContact.userId, userId), eq(savedContact.cvu, cvu))).limit(1)
  return Boolean(row)
}
