/**
 * Corrige nombres internos que todavía dicen UniCred.
 * No toca emails ni contraseñas.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

function branded(value: string) {
  return value.replaceAll('UniCred', 'UNICRÉDITOS')
}

async function main() {
  const { db, pool } = await import('@/lib/db')
  const { loanProduct, merchant, user } = await import('@/lib/db/schema')
  const { eq, like } = await import('drizzle-orm')

  const users = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(like(user.name, '%UniCred%'))
  for (const row of users) {
    const next = branded(row.name)
    if (next === row.name) continue
    await db.update(user).set({ name: next, updatedAt: new Date() }).where(eq(user.id, row.id))
    console.log(`user ${row.email}: ${row.name} → ${next}`)
  }

  const products = await db.select({ id: loanProduct.id, name: loanProduct.name }).from(loanProduct).where(like(loanProduct.name, '%UniCred%'))
  for (const row of products) {
    const next = branded(row.name)
    if (next === row.name) continue
    await db.update(loanProduct).set({ name: next }).where(eq(loanProduct.id, row.id))
    console.log(`product ${row.id}: ${row.name} → ${next}`)
  }

  const shops = await db.select({ id: merchant.id, businessName: merchant.businessName }).from(merchant).where(like(merchant.businessName, '%UniCred%'))
  for (const row of shops) {
    const next = branded(row.businessName)
    if (next === row.businessName) continue
    await db.update(merchant).set({ businessName: next, updatedAt: new Date() }).where(eq(merchant.id, row.id))
    console.log(`merchant ${row.id}: ${row.businessName} → ${next}`)
  }

  if (!users.length && !products.length && !shops.length) {
    console.log('Nada para renombrar.')
  }

  await pool.end()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
