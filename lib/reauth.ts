import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account } from '@/lib/db/schema'
import { consumeRateLimit } from '@/lib/rate-limit'

/** Re-autenticacion con la clave actual (con tope de intentos). No abre ni cierra sesiones. */
export async function verifyCurrentPassword(userId: string, password: string): Promise<'ok' | 'invalid' | 'rate_limited'> {
  if (!password) return 'invalid'
  const gate = await consumeRateLimit(`reauth:${userId}`, 5, 10 * 60_000)
  if (!gate.ok) return 'rate_limited'
  const [row] = await db
    .select({ hash: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .limit(1)
  if (!row?.hash) return 'invalid'
  const ctx = await auth.$context
  return (await ctx.password.verify({ hash: row.hash, password })) ? 'ok' : 'invalid'
}