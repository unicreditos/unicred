import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

const targetEmail = process.argv[2]

if (!targetEmail) {
  console.error('Uso: npx tsx scripts/make-admin.ts <email>')
  process.exit(1)
}

async function main() {
  const { db, pool } = await import('@/lib/db')
  const { profile, user } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const [u] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, targetEmail))
    .limit(1)

  if (!u) {
    console.error(`Usuario con email ${targetEmail} no encontrado`)
    process.exit(1)
  }

  await db
    .update(user)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(user.id, u.id))

  await db
    .insert(profile)
    .values({
      id: `prof_admin_${u.id.slice(-8)}`,
      userId: u.id,
      role: 'admin',
      kycStatus: 'approved',
      creditScore: 850,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: { role: 'admin', updatedAt: new Date(), kycStatus: 'approved' },
    })

  console.log(`${u.email} ahora es ADMIN`)
  await pool.end()
}

main().catch((e) => {
  console.error('Error:', e.message || e)
  process.exit(1)
})
