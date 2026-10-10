'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { DESK_CACHE_TAG } from '@/lib/admin-desk/load'
import { isEmailConfigured } from '@/lib/email'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/rbac'
import { verifyCurrentPassword } from '@/lib/reauth'
import {
  changeOperatorEmail,
  changeOperatorPassword,
  deleteOperator,
  resendOperatorVerification,
  type OperatorDeps,
  type OpResult,
  type VerificationOutcome,
} from '@/lib/operators/service'

/** Resultado que viaja al navegador: solo texto y códigos, nunca datos sensibles. */
export type OperatorActionResult = { ok: true; message: string } | { ok: false; code: string; message: string }

function realDeps(): OperatorDeps {
  return {
    db,
    hashPassword: async (password) => (await auth.$context).password.hash(password),
    sendVerification: async (email): Promise<VerificationOutcome> => {
      await auth.api.sendVerificationEmail({ body: { email, callbackURL: '/sign-in' } })
      return 'sent'
    },
    isEmailConfigured,
    rateLimit: (key, limit, windowMs) => consumeRateLimit(key, limit, windowMs),
    audit: async (e) => {
      await recordAudit({ ...e, entityType: 'operator' })
    },
  }
}

function strip(r: OpResult<object>): OperatorActionResult {
  return r.ok ? { ok: true, message: r.message } : { ok: false, code: r.code, message: r.message }
}

/**
 * Puerta común: permiso users.manage (solo Super Admin por defecto) y re-autenticación
 * con la clave actual de quien actúa. Sin las dos cosas no se toca nada.
 */
async function gate(actorPassword: string): Promise<{ actorId: string } | { error: OperatorActionResult }> {
  let actorId: string
  try {
    actorId = await requirePermission('users.manage')
  } catch {
    return { error: { ok: false, code: 'forbidden', message: 'No tenés permiso para gestionar operadores.' } }
  }
  const re = await verifyCurrentPassword(actorId, String(actorPassword ?? ''))
  if (re === 'rate_limited') {
    return { error: { ok: false, code: 'rate_limited', message: 'Demasiados intentos de confirmación. Esperá unos minutos.' } }
  }
  if (re !== 'ok') {
    return { error: { ok: false, code: 'bad_reauth', message: 'Tu clave actual no es correcta.' } }
  }
  return { actorId }
}

function done(r: OperatorActionResult): OperatorActionResult {
  if (r.ok) {
    updateTag(DESK_CACHE_TAG)
    revalidatePath('/admin/sistema/operadores')
  }
  return r
}

async function run(
  actorPassword: string,
  fn: (actorId: string, deps: OperatorDeps) => Promise<OpResult<object>>,
): Promise<OperatorActionResult> {
  try {
    const g = await gate(actorPassword)
    if ('error' in g) return g.error
    return done(strip(await fn(g.actorId, realDeps())))
  } catch (err) {
    console.error('[operadores] error inesperado:', (err as Error).message)
    return { ok: false, code: 'error', message: 'No se pudo completar la acción. Probá de nuevo.' }
  }
}

export async function changeOperatorPasswordAction(input: {
  targetId: string
  newPassword: string
  actorPassword: string
}): Promise<OperatorActionResult> {
  return run(input.actorPassword, (actorId, deps) =>
    changeOperatorPassword(deps, { actorId, targetId: input.targetId, newPassword: input.newPassword }),
  )
}

export async function changeOperatorEmailAction(input: {
  targetId: string
  newEmail: string
  actorPassword: string
}): Promise<OperatorActionResult> {
  return run(input.actorPassword, (actorId, deps) =>
    changeOperatorEmail(deps, { actorId, targetId: input.targetId, newEmail: input.newEmail }),
  )
}

export async function resendOperatorVerificationAction(input: {
  targetId: string
  actorPassword: string
}): Promise<OperatorActionResult> {
  return run(input.actorPassword, (actorId, deps) => resendOperatorVerification(deps, { actorId, targetId: input.targetId }))
}

export async function deleteOperatorAction(input: {
  targetId: string
  confirmEmail: string
  reason: string
  actorPassword: string
}): Promise<OperatorActionResult> {
  return run(input.actorPassword, (actorId, deps) =>
    deleteOperator(deps, { actorId, targetId: input.targetId, confirmEmail: input.confirmEmail, reason: input.reason }),
  )
}
