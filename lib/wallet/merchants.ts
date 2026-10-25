import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { merchant, walletAccount } from '@/lib/db/schema'
import { ensureWallet } from '@/lib/wallet/ledger'

/**
 * Comercios adheridos: los comercios con alta aprobada en UNICRÉDITOS (`merchant.status = 'active'`). Cobran en su
 * propia billetera, así que pagarles es una transferencia interna (instantánea y sin costo), también con QR.
 */
export async function listAdheredMerchants(excludeUserId?: string) {
  const rows = await db
    .select({
      id: merchant.id,
      userId: merchant.userId,
      businessName: merchant.businessName,
      category: merchant.category,
      city: merchant.city,
      province: merchant.province,
      address: merchant.address,
    })
    .from(merchant)
    .where(and(eq(merchant.status, 'active')))
    .orderBy(asc(merchant.businessName))

  const out: Array<(typeof rows)[number] & { alias: string }> = []
  for (const m of rows) {
    if (m.userId === excludeUserId) continue
    // La billetera del comercio se crea al listarlo si todavía no existe (es de su titular, queda en cero).
    const [w] = await db.select({ alias: walletAccount.alias, status: walletAccount.status }).from(walletAccount).where(eq(walletAccount.userId, m.userId)).limit(1)
    const wallet = w ?? (await ensureWallet(m.userId))
    if (wallet.status !== 'active') continue
    out.push({ ...m, alias: wallet.alias })
  }
  return out
}
