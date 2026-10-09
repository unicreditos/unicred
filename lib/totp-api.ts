import QRCode from 'qrcode'
import { adminJson, rejectCrossOrigin, requestMeta } from '@/lib/admin-api'
import { verifyCurrentPassword } from '@/lib/reauth'
import { sessionUser } from '@/lib/second-factor-api'
import { getRoleForUser, sessionSecondFactorOk } from '@/lib/session'
import { secondFactorRequiredFor } from '@/lib/second-factor-core'
import { sessionPassedSecondFactor } from '@/lib/second-factor'
import { beginTotpEnrol, confirmTotpEnrol, disableTotp, regenerateBackupCodes, totpStatus, verifySecondFactorCode } from '@/lib/totp'

const MSG = {
  rate_limited: 'Demasiados intentos. Esper\u00e1 unos minutos e intent\u00e1 de nuevo.',
  not_enrolled: 'No ten\u00e9s la app autenticadora activada.',
  invalid: 'C\u00f3digo incorrecto.',
  replayed: 'Ese c\u00f3digo ya se us\u00f3. Esper\u00e1 el siguiente de tu app.',
} as const

async function body(req: Request) {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>
}

/** Estado para el formulario de ingreso y la pantalla de seguridad. No exige el segundo factor (es lo que consulta el login). */
export async function handleStatus() {
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  const role = await getRoleForUser(who.userId)
  const fr = role === 'admin' ? 'admin' : role === 'merchant' ? 'merchant' : 'customer'
  const st = await totpStatus(who.userId).catch(() => ({ enabled: false, pending: false, backupRemaining: 0 }))
  const required = secondFactorRequiredFor(fr) || st.enabled
  const passed = await sessionPassedSecondFactor(who.userId, who.sessionId)
  return adminJson({
    ok: true,
    required,
    passed,
    totpEnabled: st.enabled,
    totpPending: st.pending,
    backupRemaining: st.backupRemaining,
    endpoint: role === 'admin' ? '/api/admin/2fa' : '/api/2fa',
  })
}

/** Alta: pide la clave actual (re-autenticacion) y, si ya hay segundo factor exigido, que esta sesion lo haya pasado. */
export async function handleBegin(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (!(await sessionSecondFactorOk(who.userId))) return adminJson({ ok: false, message: 'Complet\u00e1 primero la verificaci\u00f3n en dos pasos.' }, 403)
  const b = await body(req)
  const re = await verifyCurrentPassword(who.userId, String(b.password ?? ''))
  if (re !== 'ok') return adminJson({ ok: false, message: re === 'rate_limited' ? MSG.rate_limited : 'La contrase\u00f1a no coincide.' }, re === 'rate_limited' ? 429 : 400)
  const out = await beginTotpEnrol({ userId: who.userId, account: who.email })
  if (!out.ok) {
    return adminJson({ ok: false, message: out.reason === 'already_enabled' ? 'La app autenticadora ya est\u00e1 activada. Desactivala primero para cambiarla.' : MSG.rate_limited }, out.reason === 'already_enabled' ? 409 : 429)
  }
  const qr = await QRCode.toDataURL(out.uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
  return adminJson({ ok: true, uri: out.uri, secret: out.secretBase32.match(/.{1,4}/g)?.join(' ') ?? out.secretBase32, qr })
}

export async function handleConfirm(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (!(await sessionSecondFactorOk(who.userId))) return adminJson({ ok: false, message: 'Complet\u00e1 primero la verificaci\u00f3n en dos pasos.' }, 403)
  const b = await body(req)
  const { ip } = requestMeta(req)
  const out = await confirmTotpEnrol({ userId: who.userId, code: String(b.code ?? ''), sessionId: who.sessionId, ip })
  if (!out.ok) {
    const msg = out.reason === 'rate_limited' ? MSG.rate_limited : out.reason === 'no_pending' ? 'No hay un alta en curso. Empez\u00e1 de nuevo.' : MSG.invalid
    return adminJson({ ok: false, message: msg }, out.reason === 'rate_limited' ? 429 : 400)
  }
  return adminJson({ ok: true, backupCodes: out.backupCodes })
}

/** Paso del ingreso: acepta codigo de la app (6 digitos) o de respaldo. */
export async function handleVerifyTotp(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  const b = await body(req)
  const { ip } = requestMeta(req)
  const res = await verifySecondFactorCode({ userId: who.userId, code: String(b.code ?? ''), sessionId: who.sessionId, ip })
  if (!res.ok) return adminJson({ ok: false, reason: res.reason, message: MSG[res.reason] }, res.reason === 'rate_limited' ? 429 : 400)
  return adminJson({ ok: true, method: res.method, backupRemaining: res.backupRemaining ?? null })
}

async function reauth(req: Request) {
  const who = await sessionUser()
  if (!who) return { err: adminJson({ ok: false, message: 'No autorizado' }, 401) }
  if (!(await sessionSecondFactorOk(who.userId))) return { err: adminJson({ ok: false, message: 'Complet\u00e1 primero la verificaci\u00f3n en dos pasos.' }, 403) }
  const b = await body(req)
  const pw = await verifyCurrentPassword(who.userId, String(b.password ?? ''))
  if (pw !== 'ok') return { err: adminJson({ ok: false, message: pw === 'rate_limited' ? MSG.rate_limited : 'La contrase\u00f1a no coincide.' }, pw === 'rate_limited' ? 429 : 400) }
  const f = await verifySecondFactorCode({ userId: who.userId, code: String(b.code ?? ''), sessionId: who.sessionId, ip: requestMeta(req).ip, grant: false })
  if (!f.ok) return { err: adminJson({ ok: false, message: MSG[f.reason] }, f.reason === 'rate_limited' ? 429 : 400) }
  return { who }
}

/** Desactivar y regenerar exigen RE-AUTENTICAR: clave actual + un codigo vigente (app o respaldo). */
export async function handleDisable(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const r = await reauth(req)
  if (r.err) return r.err
  await disableTotp(r.who!.userId)
  return adminJson({ ok: true })
}

export async function handleRegenerate(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const r = await reauth(req)
  if (r.err) return r.err
  const out = await regenerateBackupCodes(r.who!.userId)
  if (!out.ok) return adminJson({ ok: false, message: MSG.not_enrolled }, 400)
  return adminJson({ ok: true, backupCodes: out.backupCodes })
}