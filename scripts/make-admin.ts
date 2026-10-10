import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'
import { confirmDangerousScript } from './confirm-danger'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

const targetEmail = process.argv[2]

if (!targetEmail) {
  console.error('Uso: npx tsx scripts/make-admin.ts <email> --yes')
  process.exit(1)
}

confirmDangerousScript(`Otorgar rol ADMIN a ${targetEmail}`)

async function main() {
  const { db, pool } = await import('@/lib/db')
  const { profile, user } = await import('@/lib/db/schema')
  const { ensureRbacSchema } = await import('@/lib/db/ensure-rbac')
  const { eq, sql } = await import('drizzle-orm')

  await ensureRbacSchema()

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
      adminRoleId: 'role_super_admin',
      kycStatus: 'approved',
      creditScore: 850,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profile.userId,
      // Sin rol de operador el backoffice filtra todas las secciones y el panel se ve vacío.
      // Un rol ya asignado se respeta.
      set: {
        role: 'admin',
        adminRoleId: sql`COALESCE(${profile.adminRoleId}, 'role_super_admin')`,
        updatedAt: new Date(),
        kycStatus: 'approved',
      },
    })

  console.log(`${u.email} ahora es ADMIN con rol de operador asignado`)
  await pool.end()
}

main().catch((e) => {
  console.error('Error:', e.message || e)
  process.exit(1)
})
