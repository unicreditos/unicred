import { BCRAReportPrintable } from '@/components/documents/bcra-report-printable'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { bcraReport, profile, user } from '@/lib/db/schema'
import { canViewOwnedRecord, documentBackHref } from '@/lib/legal/access'
import { documentPdfBaseName } from '@/lib/document-filename'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BCRAReportPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const backHref = await documentBackHref(userId)
  const { id: rawId } = await params
  const id = String(rawId ?? '').trim()
  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Informe no encontrado</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  let report: typeof bcraReport.$inferSelect | null = null
  try {
    const rows = await db
      .select()
      .from(bcraReport)
      .where(eq(bcraReport.id, id))
      .limit(1)
    const raw = rows[0] ?? null
    report = raw && (await canViewOwnedRecord(userId, raw.userId)) ? raw : null
  } catch (e) {
    console.warn('[informe-bcra page] bcra_report select failed:', e instanceof Error ? e.message : String(e))
    report = null
  }

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Informe no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            Este documento no existe o no pertenece a tu cuenta. Generá uno nuevo desde Scoring BCRA.
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

  let branding: Record<string, unknown> = (report.branding as Record<string, unknown> | null) ?? {}
  if (typeof report.branding === 'string') {
    try {
      branding = JSON.parse(report.branding)
    } catch {
      branding = {}
    }
  }
  let full: Record<string, unknown> = (report.fullReportData as Record<string, unknown> | null) ?? {}
  if (typeof report.fullReportData === 'string') {
    try {
      full = JSON.parse(report.fullReportData)
    } catch {
      full = {}
    }
  }

  const reportNumber = report.reportNumber ?? `INF-BCRA-${id.slice(0, 8).toUpperCase()}`

  let rows: { profile: typeof profile.$inferSelect; user: typeof user.$inferSelect }[] = []
  try {
    rows = await db
      .select({ profile: profile, user: user })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(eq(profile.userId, userId))
      .limit(1)
  } catch (e) {
    console.warn('[informe-bcra page] profile+user select failed:', e instanceof Error ? e.message : String(e))
  }
  const p = rows[0]?.profile ?? null
  const u = rows[0]?.user ?? null

  const data = {
    id,
    reportNumber,
    scoreAtGeneration: report.scoreAtGeneration,
    worstSituation: report.worstSituation,
    totalDebt: report.totalDebt,
    entitiesCount: report.entitiesCount,
    hasRejectedChecks: !!report.hasRejectedChecks,
    createdAt: report.createdAt ?? new Date(),
    expiresAt: report.expiresAt,
    branding,
    customer: {
      name: u?.name ?? null,
      cuil: p?.cuil ?? null,
      dni: p?.dni ?? null,
      email: u?.email ?? null,
      city: p?.city ?? null,
      province: p?.province ?? null,
    },
    fullReportData: full,
    synthetic: false,
  }

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`Informe ${reportNumber}`}
      fileName={documentPdfBaseName('Informe-BCRA', String(reportNumber))}
    >
      <BCRAReportPrintable report={data} />
    </DocumentPreviewShell>
  )
}
