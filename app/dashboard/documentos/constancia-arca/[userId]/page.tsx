import { ArcaConstanciaPrintable } from '@/components/documents/arca-constancia-printable'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { loadConstanciaForUser } from '@/lib/arca/constancia-store'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { keepCustomerInDashboard } from '@/lib/documents/keep-customer-in-dashboard'
import { canViewOwnedRecord, documentBackHref } from '@/lib/legal/access'
import { documentPdfBaseName } from '@/lib/document-filename'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ArcaConstanciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ embed?: string | string[] }>
}) {
  const { userId: rawId } = await params
  const ownerId = String(rawId ?? '').trim()
  await keepCustomerInDashboard('arca', ownerId, searchParams)
  const viewerId = await requireUserId()
  const backHref = await documentBackHref(viewerId, ownerId)

  if (!ownerId || !(await canViewOwnedRecord(viewerId, ownerId))) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Constancia no encontrada</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const snapshot = await loadConstanciaForUser(ownerId)
  const [holder] = await db.select({ name: user.name }).from(user).where(eq(user.id, ownerId)).limit(1)

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">ARCA no devolvió constancia</h1>
          <p className="text-sm text-muted-foreground">
            El padrón no respondió para este CUIT o el certificado WSAA no está habilitado.
          </p>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`Constancia ARCA ${snapshot.cuil}`}
      fileName={documentPdfBaseName('Constancia-ARCA', snapshot.cuil)}
    >
      <ArcaConstanciaPrintable snapshot={snapshot} holderName={holder?.name} />
    </DocumentPreviewShell>
  )
}
