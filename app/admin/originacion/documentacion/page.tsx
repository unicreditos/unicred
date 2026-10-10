import { desc, eq, sql } from 'drizzle-orm'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import { DocumentGalleryManager, type DocumentItem } from '@/components/admin/document-gallery-manager'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { kycVerification, profile, user } from '@/lib/db/schema'
import { fmtDni } from '@/lib/uc/admin'

export const metadata = { title: 'Documentación y Capturas' }

const SHOWN = 24

export default async function DocumentacionPage() {
  const { perms, userId } = await loadDesk()
  const head = (
    <PageHead
      title="Documentación y Capturas"
      description="DNI, selfie y video reales de la verificación Didit. Las 24 fichas más recientes; el resto se abre desde Clientes."
    />
  )
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="la documentación de los clientes" /></>
  await auditAdminView(userId, 'documentacion_kyc')

  const found = await db
    .select({
      id: kycVerification.id,
      userId: kycVerification.userId,
      status: kycVerification.status,
      updatedAt: kycVerification.updatedAt,
      reviewedAt: kycVerification.reviewedAt,
      userName: user.name,
      userEmail: user.email,
      dni: profile.dni,
      front: sql<boolean>`${kycVerification.dniFrontImageUrl} is not null`,
      back: sql<boolean>`${kycVerification.dniBackImageUrl} is not null`,
      selfie: sql<boolean>`${kycVerification.selfieImageUrl} is not null`,
      video: sql<boolean>`${kycVerification.videoUrl} is not null`,
    })
    .from(kycVerification)
    .leftJoin(user, eq(user.id, kycVerification.userId))
    .leftJoin(profile, eq(profile.userId, kycVerification.userId))
    .orderBy(desc(kycVerification.updatedAt))
    .limit(100)
    .catch(() => [])

  const withMedia = found.filter((row) => row.userId && (row.front || row.back || row.selfie || row.video))
  const shown = withMedia.slice(0, SHOWN)
  const docItems: DocumentItem[] = []

  for (const row of shown) {
    const owner = row.userId as string
    const cName = row.userName || 'Cliente'
    const cEmail = [row.userEmail, row.dni ? `DNI ${fmtDni(row.dni)}` : null].filter(Boolean).join(' · ')
    const cStatus: DocumentItem['status'] =
      row.status === 'verified' || row.status === 'approved'
        ? 'Aprobado'
        : row.status === 'rejected'
          ? 'Observado'
          : 'Pendiente'
    const up = row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    const rev = row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null
    const push = (suffix: string, docType: DocumentItem['docType'], kind: string) => {
      docItems.push({
        id: `${row.id}-${suffix}`,
        clientName: cName,
        clientEmail: cEmail || '—',
        clientId: owner,
        docType,
        status: cStatus,
        uploadedAt: up,
        reviewedAt: rev,
        imageUrl: `/api/admin/kyc-media/${encodeURIComponent(owner)}/${kind}`,
      })
    }
    if (row.front) push('front', 'DNI frente', 'front')
    if (row.back) push('back', 'DNI dorso', 'back')
    if (row.selfie) push('selfie', 'Selfie con DNI', 'selfie')
    if (row.video) push('video', 'Video de prueba de vida', 'video')
  }

  return (
    <>
      {head}
      <div className="mt-4">
        {docItems.length === 0 ? (
          <p className="uc-note">No hay capturas Didit guardadas. Cuando un cliente complete la verificación, el DNI, la selfie y el video aparecen acá y en su ficha.</p>
        ) : (
          <>
            {withMedia.length > SHOWN ? (
              <p className="uc-note" style={{ marginBottom: 12 }}>
                Hay {withMedia.length} fichas con capturas. Acá se ven las {SHOWN} más recientes. El resto está en Clientes, abriendo Ver legajo.
              </p>
            ) : null}
            <DocumentGalleryManager documents={docItems} />
          </>
        )}
      </div>
    </>
  )
}
