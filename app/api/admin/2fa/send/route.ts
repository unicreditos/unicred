import { eq } from 'drizzle-orm'
import { issueAdminOtp } from '@/lib/admin-otp'
import { adminJson, authErrorStatus, requestMeta } from '@/lib/admin-api'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Env\u00eda al correo del operador un c\u00f3digo de 6 d\u00edgitos (10 min, 5 env\u00edos por hora). */
export async function POST(req: Request) {
  let userId: string
  try {
    userId = await requirePermission('kyc.review')
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, authErrorStatus(err))
  }
  try {
    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
    if (!u?.email) return adminJson({ ok: false, message: 'Tu usuario no tiene correo.' }, 400)
    const { ip } = requestMeta(req)
    const { expiresAt } = await issueAdminOtp({ userId, email: u.email, ip })
    return adminJson({ ok: true, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 400)
  }
}