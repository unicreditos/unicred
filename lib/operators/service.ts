import { and, eq, sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import { account, adminRole, profile, session, user } from '@/lib/db/schema'
import {
  NON_HISTORY_TABLES,
  VERIFY_MAIL_LIMIT,
  VERIFY_MAIL_WINDOW_MS,
  anonymizedEmail,
  decideDelete,
  isAnonymizedEmail,
  isPlaceholderEmail,
  isValidEmail,
  normalizeEmail,
  validateNewPassword,
  validateReason,
} from '@/lib/operators/policy'

export type OperatorsDb = PgDatabase<any, any, any>

export type VerificationOutcome = 'sent' | 'not_configured' | 'failed'

/** Todo lo que toca el mundo exterior entra por acá, para probar el servicio sin red ni base real. */
export type OperatorDeps = {
  db: OperatorsDb
  hashPassword: (password: string) => Promise<string>
  sendVerification: (email: string) => Promise<VerificationOutcome>
  isEmailConfigured: () => boolean
  rateLimit: (key: string, limit: number, windowMs: number) => Promise<{ ok: boolean }>
  audit: (entry: {
    actorUserId: string
    action: string
    entityId: string
    targetUserId?: string | null
    severity: 'info' | 'warning' | 'error'
    summary: string
    changes?: Record<string, unknown>
  }) => Promise<void>
}

export type OpResult<T extends object = object> =
  | ({ ok: true; message: string } & T)
  | { ok: false; code: string; status: number; message: string }

const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message })

type Target = { id: string; name: string; email: string; emailVerified: boolean; banned: boolean; isOperator: boolean }

async function loadTarget(db: OperatorsDb, id: string): Promise<Target | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      banned: user.banned,
      userRole: user.role,
      profileRole: profile.role,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, id))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    banned: Boolean(row.banned),
    isOperator: row.userRole === 'admin' || row.profileRole === 'admin',
  }
}

/** Devuelve el operador a gestionar o el error listo para mostrar. Los clientes nunca pasan. */
async function resolveOperator(deps: OperatorDeps, actorId: string, targetId: string, opts: { allowSelf?: boolean } = {}) {
  const t = await loadTarget(deps.db, String(targetId ?? ''))
  if (!t) return { error: fail(404, 'not_found', 'No se encontró el operador.') }
  if (!t.isOperator) {
    return { error: fail(403, 'not_operator', 'Desde esta pantalla solo se gestionan operadores, no clientes.') }
  }
  if (!opts.allowSelf && t.id === actorId) {
    return { error: fail(403, 'self', 'Para tu propia cuenta usá Perfil → Seguridad. Acá no se puede.') }
  }
  return { target: t }
}

async function revokeSessions(db: OperatorsDb, userId: string): Promise<number> {
  const rows = await db.delete(session).where(eq(session.userId, userId)).returning({ id: session.id })
  return rows.length
}

/* ------------------------------- clave ------------------------------- */

export async function changeOperatorPassword(
  deps: OperatorDeps,
  input: { actorId: string; targetId: string; newPassword: string },
): Promise<OpResult<{ revokedSessions: number }>> {
  const r = await resolveOperator(deps, input.actorId, input.targetId)
  if ('error' in r && r.error) return r.error
  const target = r.target!
  const policy = validateNewPassword(input.newPassword, target.email)
  if (!policy.ok) return fail(422, 'weak_password', policy.message)

  const hash = await deps.hashPassword(input.newPassword)
  const revoked = await deps.db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, target.id), eq(account.providerId, 'credential')))
      .returning({ id: account.id })
    if (!updated.length) {
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: target.id,
        providerId: 'credential',
        userId: target.id,
        password: hash,
      })
    }
    return revokeSessions(tx as unknown as OperatorsDb, target.id)
  })

  // Nunca va la clave: solo el hecho y cuántas sesiones se cerraron.
  await deps.audit({
    actorUserId: input.actorId,
    action: 'OPERATOR_PASSWORD_CHANGED',
    entityId: target.id,
    targetUserId: target.id,
    severity: 'warning',
    summary: `Clave de ${target.email} cambiada desde Operadores`,
    changes: { sesionesCerradas: revoked },
  })
  return { ok: true, message: `Clave actualizada. Se cerraron ${revoked} sesión(es) activa(s) del operador.`, revokedSessions: revoked }
}

/* ------------------------------- email ------------------------------- */

export async function changeOperatorEmail(
  deps: OperatorDeps,
  input: { actorId: string; targetId: string; newEmail: string },
): Promise<OpResult<{ verification: VerificationOutcome; email: string }>> {
  const r = await resolveOperator(deps, input.actorId, input.targetId)
  if ('error' in r && r.error) return r.error
  const target = r.target!
  const next = normalizeEmail(input.newEmail)
  if (!isValidEmail(next)) return fail(422, 'invalid_email', 'El email no tiene un formato válido.')
  if (next === normalizeEmail(target.email)) return fail(422, 'same_email', 'Ese ya es el email del operador.')
  if (isAnonymizedEmail(next)) return fail(422, 'invalid_email', 'Ese email está reservado.')

  const [taken] = await deps.db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${next}`)
    .limit(1)
  if (taken) return fail(409, 'email_in_use', 'Ese email ya está en uso por otra cuenta.')

  let revoked = 0
  try {
    revoked = await deps.db.transaction(async (tx) => {
      await tx.update(user).set({ email: next, emailVerified: false, updatedAt: new Date() }).where(eq(user.id, target.id))
      return revokeSessions(tx as unknown as OperatorsDb, target.id)
    })
  } catch (err) {
    // Otro alta pudo ganar la carrera: la restricción única de la base manda.
    if (/unique|duplicate/i.test(String((err as Error)?.message) + String((err as { code?: string })?.code))) {
      return fail(409, 'email_in_use', 'Ese email ya está en uso por otra cuenta.')
    }
    throw err
  }

  await deps.audit({
    actorUserId: input.actorId,
    action: 'OPERATOR_EMAIL_CHANGED',
    entityId: target.id,
    targetUserId: target.id,
    severity: 'warning',
    summary: `Email de operador cambiado: ${target.email} → ${next}`,
    changes: { email: { antes: target.email, despues: next }, sesionesCerradas: revoked, verificado: false },
  })

  const verification = await sendVerificationSafely(deps, next)
  const base = `Email actualizado a ${next}. Quedó sin verificar y se cerraron ${revoked} sesión(es).`
  const tail =
    verification === 'sent'
      ? ' Se envió el correo de verificación al nuevo email.'
      : verification === 'not_configured'
        ? ' Email no configurado: no se pudo enviar el correo de verificación (ver instrucciones para habilitarlo).'
        : ' No se pudo enviar el correo de verificación; probá reenviarlo.'
  return { ok: true, message: base + tail, verification, email: next }
}

async function sendVerificationSafely(deps: OperatorDeps, email: string): Promise<VerificationOutcome> {
  if (!deps.isEmailConfigured()) return 'not_configured'
  try {
    return await deps.sendVerification(email)
  } catch {
    return 'failed'
  }
}

/* ------------------------ reenviar verificación ------------------------ */

export async function resendOperatorVerification(
  deps: OperatorDeps,
  input: { actorId: string; targetId: string },
): Promise<OpResult<{ verification: VerificationOutcome }>> {
  const r = await resolveOperator(deps, input.actorId, input.targetId, { allowSelf: true })
  if ('error' in r && r.error) return r.error
  const target = r.target!
  if (target.emailVerified) return fail(409, 'already_verified', 'Ese email ya está verificado.')
  if (isAnonymizedEmail(target.email)) return fail(422, 'placeholder_email', 'Esta cuenta fue eliminada.')
  if (isPlaceholderEmail(target.email)) {
    return fail(422, 'placeholder_email', 'El email no es real (dominio de prueba). Editalo primero con un email válido.')
  }
  // Sin proveedor no hay nada que enviar: no se gasta el cupo ni se genera ningún enlace.
  if (!deps.isEmailConfigured()) {
    return fail(503, 'email_not_configured', 'Email no configurado: falta la clave del proveedor de correo (RESEND_API_KEY). No se envió nada.')
  }
  const gate = await deps.rateLimit(`op-verify:${target.id}`, VERIFY_MAIL_LIMIT, VERIFY_MAIL_WINDOW_MS)
  if (!gate.ok) return fail(429, 'rate_limited', `Ya se reenvió ${VERIFY_MAIL_LIMIT} veces en la última hora. Probá más tarde.`)

  const verification = await sendVerificationSafely(deps, target.email)
  await deps.audit({
    actorUserId: input.actorId,
    action: 'OPERATOR_VERIFICATION_RESENT',
    entityId: target.id,
    targetUserId: target.id,
    severity: verification === 'sent' ? 'info' : 'warning',
    summary: `Reenvío de verificación a ${target.email}: ${verification}`,
    changes: { resultado: verification },
  })
  if (verification !== 'sent') return fail(502, 'send_failed', 'No se pudo enviar el correo de verificación. Probá de nuevo más tarde.')
  return { ok: true, message: `Correo de verificación enviado a ${target.email}.`, verification }
}

/* ------------------------------ eliminar ------------------------------ */

type FkRef = { tbl: string; col: string }

/** Todas las columnas que apuntan a "user"(id), leídas del catálogo: una tabla nueva queda cubierta sola. */
async function userReferences(db: OperatorsDb): Promise<FkRef[]> {
  const res = await db.execute(sql`
    SELECT cl.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = '"user"'::regclass
  `)
  return (res.rows as FkRef[]).map((r) => ({ tbl: String(r.tbl), col: String(r.col) }))
}

export async function collectDeleteFacts(db: OperatorsDb, actorId: string, target: Target) {
  const refs = await userReferences(db)
  const historyCounts: Record<string, number> = {}
  for (const { tbl, col } of refs) {
    if (NON_HISTORY_TABLES.has(tbl) || tbl === 'admin_audit_log') continue
    const res = await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(tbl)} WHERE ${sql.identifier(col)} = ${target.id}`)
    const n = Number((res.rows[0] as { n: number } | undefined)?.n ?? 0)
    if (n > 0) historyCounts[tbl] = (historyCounts[tbl] ?? 0) + n
  }
  const audit = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE "actorUserId" = ${target.id} AND action NOT LIKE 'AUTH!_%' ESCAPE '!')::int AS authored,
      count(*)::int AS anyrows
    FROM admin_audit_log
    WHERE "actorUserId" = ${target.id} OR "targetUserId" = ${target.id}
  `)
  const a = (audit.rows[0] ?? {}) as { authored?: number; anyrows?: number }
  const [sess] = await db.select({ n: sql<number>`count(*)::int` }).from(session).where(eq(session.userId, target.id))
  const managers = await db.execute(sql`
    SELECT count(DISTINCT u.id)::int AS n
    FROM "user" u
    JOIN profile p ON p."userId" = u.id
    JOIN admin_role_permission rp ON rp."roleId" = p."adminRoleId"
    JOIN admin_permission ap ON ap.id = rp."permissionId"
    WHERE ap.key = 'users.manage'
      AND coalesce(u.banned, false) = false
      AND (u.role = 'admin' OR p.role = 'admin')
      AND u.id <> ${target.id}
  `)
  return {
    actorId,
    targetId: target.id,
    targetIsOperator: target.isOperator,
    otherActiveManagers: Number((managers.rows[0] as { n: number } | undefined)?.n ?? 0),
    historyCounts,
    authoredAudit: Number(a.authored ?? 0),
    anyAuditRows: Number(a.anyrows ?? 0),
    sessions: Number(sess?.n ?? 0),
    emailVerified: target.emailVerified,
  }
}

export async function deleteOperator(
  deps: OperatorDeps,
  input: { actorId: string; targetId: string; confirmEmail: string; reason: string },
): Promise<OpResult<{ mode: 'hard' | 'soft' }>> {
  const r = await resolveOperator(deps, input.actorId, input.targetId)
  if ('error' in r && r.error) return r.error
  const target = r.target!
  const reason = validateReason(input.reason)
  if (!reason.ok) return fail(422, 'reason_required', reason.message)
  if (normalizeEmail(input.confirmEmail) !== normalizeEmail(target.email)) {
    return fail(422, 'confirm_mismatch', 'Escribí exactamente el email del operador para confirmar.')
  }

  const facts = await collectDeleteFacts(deps.db, input.actorId, target)
  const decision = decideDelete(facts)
  if (!decision.allowed) return fail(409, decision.code, decision.message)

  await deps.db.transaction(async (tx) => {
    if (decision.mode === 'hard') {
      await tx.delete(user).where(eq(user.id, target.id))
      return
    }
    await tx.delete(session).where(eq(session.userId, target.id))
    await tx.delete(account).where(eq(account.userId, target.id))
    await tx
      .update(profile)
      .set({ adminRoleId: null, phone: null, updatedAt: new Date() })
      .where(eq(profile.userId, target.id))
    await tx
      .update(user)
      .set({
        banned: true,
        email: anonymizedEmail(target.id),
        name: 'Operador eliminado',
        emailVerified: false,
        image: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.id))
  })

  await deps.audit({
    actorUserId: input.actorId,
    action: decision.mode === 'hard' ? 'OPERATOR_DELETED' : 'OPERATOR_DEACTIVATED',
    entityId: target.id,
    targetUserId: decision.mode === 'hard' ? null : target.id,
    severity: 'error',
    summary:
      decision.mode === 'hard'
        ? `Operador eliminado (sin historial): ${target.email}`
        : `Operador desactivado y anonimizado: ${target.email}`,
    changes: { email: target.email, nombre: target.name, motivo: input.reason.trim().slice(0, 300), modo: decision.mode },
  })
  return {
    ok: true,
    mode: decision.mode,
    message:
      decision.mode === 'hard'
        ? 'Operador eliminado.'
        : 'Operador desactivado: perdió el acceso y su email quedó anonimizado (tenía rastro, no se borra del todo).',
  }
}

/* ------------------------------- listado ------------------------------- */

export type OperatorRow = {
  id: string
  name: string
  email: string
  roleLabel: string
  verified: boolean
  banned: boolean
  placeholder: boolean
  createdAt: string
}

export async function listOperators(db: OperatorsDb): Promise<OperatorRow[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.emailVerified,
      banned: user.banned,
      createdAt: user.createdAt,
      roleLabel: adminRole.label,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .leftJoin(adminRole, eq(profile.adminRoleId, adminRole.id))
    .where(sql`(${user.role} = 'admin' OR ${profile.role} = 'admin')`)
    .orderBy(user.createdAt)
    .limit(200)
  return rows
    .filter((r) => !isAnonymizedEmail(r.email))
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      roleLabel: r.roleLabel ?? 'Sin rol',
      verified: r.verified,
      banned: Boolean(r.banned),
      placeholder: isPlaceholderEmail(r.email),
      createdAt: new Date(r.createdAt).toISOString(),
    }))
}
