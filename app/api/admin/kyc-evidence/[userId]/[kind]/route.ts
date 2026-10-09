import { hasFreshSecondFactor } from '@/lib/admin-otp'
import { requireSecondFactorForEvidence } from '@/lib/admin-otp-core'
import { adminJson, authErrorStatus, requestMeta } from '@/lib/admin-api'
import { recordAudit } from '@/lib/audit'
import { backfillLegacyEvidence, logEvidenceAccess, readEvidenceVerified } from '@/lib/evidence'
import { EVIDENCE_LABEL, evidenceResponseHeaders, isEvidenceKind } from '@/lib/evidence-core'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Entrega un archivo de identidad (DNI frente/dorso, selfie, video) SOLO a un operador con permiso kyc.review
 * que haya pasado el segundo factor por correo. Verifica el SHA-256 antes de servirlo, no se cachea y cada
 * vista queda registrada (quien, que documento, cuando, IP).
 */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string; kind: string }> }) {
  let actorId: string
  try {
    actorId = await requirePermission('kyc.review')
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, authErrorStatus(err))
  }
  const { userId, kind } = await params
  if (!isEvidenceKind(kind)) return adminJson({ ok: false, message: 'Tipo de documento inválido.' }, 400)
  const url = new URL(req.url)
  const versionParam = Number(url.searchParams.get('v'))
  const version = Number.isInteger(versionParam) && versionParam > 0 ? versionParam : null
  const { ip, userAgent } = requestMeta(req)

  try {
    if (requireSecondFactorForEvidence() && !(await hasFreshSecondFactor(actorId))) {
      await logEvidenceAccess({ ownerUserId: userId, kind, version, actorUserId: actorId, outcome: 'denied_2fa', ip, userAgent })
      return adminJson({ ok: false, code: '2FA_REQUIRED', message: 'Verificá el código que te enviamos por correo para ver documentos de identidad.' }, 403)
    }

    let result = await readEvidenceVerified(userId, kind, version)
    if (!result.ok && result.reason === 'not_found' && !version) {
      await backfillLegacyEvidence(userId)
      result = await readEvidenceVerified(userId, kind, null)
    }
    if (!result.ok) {
      await logEvidenceAccess({
        evidenceId: result.meta?.id,
        ownerUserId: userId,
        kind,
        version: result.meta?.version ?? version,
        actorUserId: actorId,
        outcome: result.reason,
        ip,
        userAgent,
      })
      if (result.reason === 'hash_mismatch') {
        await recordAudit({
          actorUserId: actorId,
          action: 'KYC_EVIDENCE_INTEGRITY_FAILED',
          entityType: 'kyc_evidence',
          entityId: result.meta?.id ?? null,
          targetUserId: userId,
          severity: 'error',
          summary: `Falló la verificación de integridad de ${EVIDENCE_LABEL[kind]}`,
        })
        return adminJson({ ok: false, code: 'INTEGRITY_FAILED', message: 'El archivo no coincide con su huella SHA-256. No se entrega.' }, 409)
      }
      return adminJson({ ok: false, message: 'No hay documento cargado.' }, 404)
    }

    await logEvidenceAccess({
      evidenceId: result.meta.id,
      ownerUserId: userId,
      kind,
      version: result.meta.version,
      actorUserId: actorId,
      outcome: 'served',
      ip,
      userAgent,
    })
    await recordAudit({
      actorUserId: actorId,
      action: 'KYC_EVIDENCE_VIEWED',
      entityType: 'kyc_evidence',
      entityId: result.meta.id,
      targetUserId: userId,
      summary: `Vio ${EVIDENCE_LABEL[kind]} (v${result.meta.version})`,
      changes: { ip, sha256: result.meta.sha256 },
    })
    const ext = result.meta.mime.split('/')[1] ?? 'bin'
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: evidenceResponseHeaders({
        mime: result.meta.mime,
        sha256: result.meta.sha256,
        filename: `${kind}-v${result.meta.version}.${ext}`,
        size: result.bytes.byteLength,
      }),
    })
  } catch (err) {
    return adminJson({ ok: false, message: 'No se pudo leer la evidencia: ' + (err as Error).message }, 500)
  }
}