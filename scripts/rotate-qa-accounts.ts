// Rotacion de las cuentas QA: las bloquea y revoca sus sesiones (la clave vieja deja de servir).
// NO se ejecuta automaticamente. Modo por defecto: --dry-run (solo informa). Requiere --yes para escribir.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'
import { assertSafeSeedTarget } from './qa-seed-guard'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

export const QA_EMAILS = [
  'qa-persona-audit@unicreditos.com',
  'qa-comercio-audit@unicreditos.com',
  'qa-admin-audit@unicreditos.com',
]

async function main() {
  const apply = process.argv.includes('--yes')
  if (apply) assertSafeSeedTarget(process.env)
  const { db, pool } = await import('@/lib/db')
  const { user, session } = await import('@/lib/db/schema')
  const { eq, inArray } = await import('drizzle-orm')
  const rows = await db.select({ id: user.id, email: user.email, banned: user.banned }).from(user).where(inArray(user.email, QA_EMAILS))
  console.log(`Cuentas QA encontradas: ${rows.length}`)
  for (const r of rows) console.log(` - ${r.email} banned=${r.banned}`)
  if (!apply) {
    console.log('Dry-run: no se modifico nada. Usa --yes (en una base permitida) para bloquear y revocar sesiones.')
    await pool.end()
    return
  }
  for (const r of rows) {
    await db.delete(session).where(eq(session.userId, r.id))
    await db.update(user).set({ banned: true, updatedAt: new Date() }).where(eq(user.id, r.id))
  }
  console.log('Cuentas QA bloqueadas y sesiones revocadas.')
  await pool.end()
}

if (process.argv[1] && process.argv[1].includes('rotate-qa-accounts')) {
  main().catch((e) => {
    console.error('Error:', e?.message || e)
    process.exit(1)
  })
}