'use server'

import { checkActionLimit } from '@/lib/action-rate-limit'
import { recordAudit } from '@/lib/audit'

import { persistBcraConsultation } from '@/lib/bcra-persist'
import { db } from '@/lib/db'
import { profile } from '@/lib/db/schema'
import { assertRole } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function consultMyBcra() {
  const userId = await assertRole('customer')
  const gate = await checkActionLimit('bcra', userId)
  if (!gate.ok) return { ok: false as const, error: gate.message }
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!prof?.cuil) {
    return { ok: false as const, error: 'Completá tu CUIL en Mis datos antes de consultar el BCRA.' }
  }
  const result = await persistBcraConsultation({
    userId,
    cuil: prof.cuil,
    monthlyIncome: Number(prof.monthlyIncome ?? 0),
  })
  if (result.ok) {
    await recordAudit({
      actorUserId: userId,
      action: 'BCRA_CONSULTED',
      entityType: 'profile',
      entityId: userId,
      targetUserId: userId,
      summary: 'Se consultó la Central de Deudores del BCRA para el cliente',
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/perfil/bcra')
  }
  return result
}

