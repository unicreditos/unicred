/**
 * Elimina al 100% movimientos y saldos de prueba (sandbox_load) y recalcula balances.
 * Uso: npx tsx scripts/purge-sandbox-wallet-data.ts
 */
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

async function main() {
  const { db } = await import('../lib/db')
  const { walletAccount, walletMovement } = await import('../lib/db/schema')

  const sandboxRows = await db
    .select({
      id: walletMovement.id,
      walletId: walletMovement.walletId,
      amount: walletMovement.amount,
      direction: walletMovement.direction,
    })
    .from(walletMovement)
    .where(eq(walletMovement.kind, 'sandbox_load'))

  console.log(`sandbox_load encontrados: ${sandboxRows.length}`)
  if (sandboxRows.length === 0) {
    console.log('Nada que purgar.')
    return
  }

  const walletIds = [...new Set(sandboxRows.map((r) => r.walletId))]
  const ids = sandboxRows.map((r) => r.id)

  await db.delete(walletMovement).where(inArray(walletMovement.id, ids))
  console.log(`Eliminados ${ids.length} movimientos sandbox_load`)

  for (const walletId of walletIds) {
    const remaining = await db
      .select()
      .from(walletMovement)
      .where(eq(walletMovement.walletId, walletId))
      .orderBy(asc(walletMovement.createdAt), asc(walletMovement.id))

    let balance = 0
    for (const m of remaining) {
      const amt = Number(m.amount)
      if (m.direction === 'credit') balance += amt
      else balance -= amt
      balance = Math.round(balance * 100) / 100
      await db
        .update(walletMovement)
        .set({ balanceAfter: String(balance.toFixed(2)) })
        .where(eq(walletMovement.id, m.id))
    }
    if (balance < 0) balance = 0
    await db
      .update(walletAccount)
      .set({ balance: String(balance.toFixed(2)), updatedAt: new Date() })
      .where(eq(walletAccount.id, walletId))
    console.log(`wallet ${walletId} → saldo $${balance.toFixed(2)} (${remaining.length} movs)`)
  }

  const leftover = await db.execute(sql`
    select count(*)::int as c from wallet_movement where kind = 'sandbox_load'
  `)
  console.log('sandbox_load restantes:', leftover)
  console.log('OK: datos de prueba purgados.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
