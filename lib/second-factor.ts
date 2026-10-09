import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** La sesion actual ya paso el codigo por correo (no vence antes que la sesion). Falla cerrado ante errores. */
export async function sessionPassedSecondFactor(userId: string, sessionId: string | null | undefined): Promise<boolean> {
  if (!sessionId) return false
  try {
    const res = await db.execute(
      sql`SELECT 1 FROM admin_second_factor WHERE "userId" = ${userId} AND "sessionId" = ${sessionId} LIMIT 1`,
    )
    return res.rows.length > 0
  } catch (err) {
    console.warn('[2fa] no se pudo leer el segundo factor:', (err as Error).message)
    return false
  }
}