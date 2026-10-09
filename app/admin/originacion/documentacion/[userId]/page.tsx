import { eq } from 'drizzle-orm'
import { KycEvidenceViewer } from '@/components/admin/kyc-evidence-viewer'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export const metadata = { title: 'Documentación del cliente' }

export default async function DocumentacionClientePage({ params }: { params: Promise<{ userId: string }> }) {
  const { perms, userId: actorId } = await loadDeskChrome()
  const { userId } = await params
  const head = <PageHead title="Documentación del cliente" description="DNI frente y dorso, selfie y video con sus versiones, huella SHA-256 y registro de accesos." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="la documentación de identidad" /></>
  await auditAdminView(actorId, 'documentacion_kyc_cliente', userId)
  const [owner] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  return (
    <>
      {head}
      <p className="uc-muted" style={{ marginBottom: 12 }}>{owner ? `${owner.name ?? ''} · ${owner.email}` : 'Cliente no encontrado'}</p>
      <KycEvidenceViewer userId={userId} />
    </>
  )
}