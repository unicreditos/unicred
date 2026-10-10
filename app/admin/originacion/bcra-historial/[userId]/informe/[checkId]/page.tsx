import { BCRAReportPrintable } from '@/components/documents/bcra-report-printable'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { BackLink, NoAccess, PageHead } from '@/components/uc/blocks'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { snapshotFromStored } from '@/lib/bcra'
import { bcraFullReportFromCheck } from '@/lib/bcra-report'
import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { bcraCheck, profile, user } from '@/lib/db/schema'
import { documentPdfBaseName } from '@/lib/document-filename'
import { documentPreviewFlags } from '@/lib/documents/preview-flags'
import { and, eq } from 'drizzle-orm'

export const metadata = { title: 'Informe BCRA del cliente' }
export const dynamic = 'force-dynamic'

/** Informe imprimible de una consulta puntual a la Central de Deudores, armado con lo que se guardó al consultar. */
export default async function BcraConsultaInformePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; checkId: string }>
  searchParams: Promise<{ embed?: string | string[]; print?: string | string[] }>
}) {
  const { perms, userId: actor } = await loadDeskChrome()
  const { userId, checkId } = await params
  const { embed, autoPrint } = documentPreviewFlags(await searchParams)
  const back = `/admin/originacion/bcra-historial/${encodeURIComponent(userId)}`
  if (!perms.has('risk.read')) {
    return (
      <>
        <PageHead title="Informe BCRA del cliente" />
        <NoAccess what="los informes BCRA" />
      </>
    )
  }

  const [check] = await db
    .select()
    .from(bcraCheck)
    .where(and(eq(bcraCheck.id, checkId), eq(bcraCheck.userId, userId)))
    .limit(1)
  if (!check) {
    return (
      <>
        <BackLink href={back}>Volver al historial</BackLink>
        <PageHead title="Consulta no encontrada" description="La consulta no existe o no pertenece a este cliente." />
      </>
    )
  }
  await auditAdminView(actor, 'informe_bcra_cliente', check.id)

  const [owner] = await db
    .select({
      name: user.name,
      email: user.email,
      cuil: profile.cuil,
      dni: profile.dni,
      city: profile.city,
      province: profile.province,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)

  const reportNumber = `CONS-BCRA-${check.id.replace(/^bcra[_-]/i, '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`
  const full = bcraFullReportFromCheck(check)
  const cuil = check.cuil || owner?.cuil || null

  return (
    <DocumentPreviewShell
      backHref={back}
      meta={`Informe BCRA · ${owner?.name ?? cuil ?? 'Cliente'}`}
      fileName={documentPdfBaseName('Informe-BCRA', `${cuil ?? 'cliente'}-${reportNumber}`)}
      embed={embed}
      autoPrint={autoPrint}
    >
      <BCRAReportPrintable
        report={{
          id: check.id,
          reportNumber,
          scoreAtGeneration: check.computedScore,
          worstSituation: check.worstSituation,
          totalDebt: check.totalDebt,
          entitiesCount: check.entitiesCount,
          hasRejectedChecks: !!check.hasRejectedChecks,
          createdAt: check.consultedAt ?? check.createdAt,
          branding: { ...receiptBranding(), reportType: 'Informe de Situación Crediticia BCRA' },
          customer: {
            name: owner?.name ?? null,
            cuil,
            dni: owner?.dni ?? null,
            email: owner?.email ?? null,
            city: owner?.city ?? null,
            province: owner?.province ?? null,
          },
          fullReportData: full,
          synthetic: false,
        }}
        extract={snapshotFromStored(full, cuil ?? undefined)}
      />
    </DocumentPreviewShell>
  )
}
