import { db } from '@/lib/db'
import { sessionPassedSecondFactorWith } from '@/lib/otp-pg-store'

/** La sesion actual ya paso el codigo por correo (no vence antes que la sesion). Falla cerrado ante errores. */
export const sessionPassedSecondFactor = (userId: string, sessionId: string | null | undefined) =>
  sessionPassedSecondFactorWith(db, userId, sessionId)
