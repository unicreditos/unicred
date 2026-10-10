import { adminJson, authFailure, serverError } from '@/lib/admin-api'
import { backfillLegacyEvidence, listEvidence, listEvidenceAccess } from '@/lib/evidence'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Versiones (metadatos y hash, sin el archivo) y accesos de la evidencia de un cliente. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requirePermission('kyc.review')
  } catch (err) {
    return authFailure(err)
  }
  const { userId } = await params
  try {
    let items = await listEvidence(userId)
    if (!items.length) {
      // Lo que hoy vive en las columnas viejas se pasa a la tabla versionada la primera vez que se consulta.
      await backfillLegacyEvidence(userId)
      items = await listEvidence(userId)
    }
    const access = await listEvidenceAccess(userId, 50)
    return adminJson({ ok: true, items, access })
  } catch (err) {
    return serverError(err, 'kyc-evidence-list')
  }
}