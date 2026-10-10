import { BcraExtractDocument } from '@/components/documents/bcra-extract-document'
import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import type { FullBcraSnapshot } from '@/lib/bcra'
import { SITUACION_BCRA } from '@/lib/bcra-labels'
import { BRAND, legalCuitLabel } from '@/lib/brand'
import { docDate, docDateTime } from '@/lib/document-format'
import { formatARS } from '@/lib/finance'

export type BCRAReportData = {
  id: string
  reportNumber: string
  scoreAtGeneration: number | null
  worstSituation: number | null
  totalDebt: string | number | null
  entitiesCount: number | null
  hasRejectedChecks: boolean | null
  createdAt: Date | string
  expiresAt?: Date | string | null
  synthetic?: boolean
  branding?: {
    company?: string
    brand?: string
    slogan?: string
    cuit?: string | null
    address?: string
    reportType?: string
    website?: string
  }
  customer?: {
    name?: string | null
    cuil?: string | null
    dni?: string | null
    email?: string | null
    city?: string | null
    province?: string | null
  }
  fullReportData?: Record<string, unknown> | null
}

function scoreLabel(score: number | null | undefined) {
  if (!score) return 'Sin score'
  if (score >= 720) return 'Excelente'
  if (score >= 640) return 'Bueno'
  if (score >= 560) return 'Regular'
  return 'Riesgo alto'
}

function situationText(value: number | null | undefined) {
  if (!value) return 'Sin deuda'
  return SITUACION_BCRA[value] ?? 'Informada'
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: number | null }) {
  return (
    <div className={`bcra-kpi${tone ? ` s${Math.min(tone, 6)}` : ''}`}>
      <p className="bcra-kpi-label">{label}</p>
      <p className="bcra-kpi-value">{value}</p>
      {hint ? <p className="bcra-kpi-hint">{hint}</p> : null}
    </div>
  )
}

export function BCRAReportPrintable({
  report,
  extract = null,
}: {
  report: BCRAReportData
  extract?: FullBcraSnapshot | null
}) {
  const branding = report.branding ?? {}
  const periods = extract?.historicas.periodos ?? []
  const worst24 = periods.reduce((acc, p) => Math.max(acc, p.worstSituation ?? 0), 0)
  const consulted = (report.fullReportData as { consultedAt?: string } | null)?.consultedAt ?? report.createdAt
  const place = [report.customer?.city, report.customer?.province].filter(Boolean).join(', ') || '—'
  const checks = extract ? extract.chequesRechazados.cheques?.length ?? 0 : report.hasRejectedChecks ? 1 : 0

  return (
    <DocumentSheet className="bcra-report">
      <DocumentLetterhead
        kind="informe"
        title={branding.reportType ?? 'Informe de situación crediticia'}
        subtitle="Central de Deudores del BCRA y score UNICRÉDITOS"
        number={report.reportNumber}
        issuedAt={docDateTime(report.createdAt)}
        validUntil={report.expiresAt ? docDate(report.expiresAt) : '30 días desde la emisión'}
        status={report.synthetic ? 'Modo seguro' : 'Confidencial'}
        statusTone={report.synthetic ? 'warn' : 'neutral'}
      />

      <DocumentSection number="01" title="Titular consultado">
        <DocumentFieldGrid>
          <DocumentField label="Nombre" value={report.customer?.name ?? '—'} />
          <DocumentField label="CUIL" value={report.customer?.cuil ?? '—'} mono />
          <DocumentField label="DNI" value={report.customer?.dni ?? '—'} mono />
          <DocumentField label="Localidad" value={place} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Resumen">
        <div className="bcra-kpis">
          <Kpi label="Score interno" value={report.scoreAtGeneration ? String(report.scoreAtGeneration) : '—'} hint={scoreLabel(report.scoreAtGeneration)} />
          <Kpi label="Sit. actual" value={report.worstSituation ? String(report.worstSituation) : '—'} hint={situationText(report.worstSituation)} tone={report.worstSituation} />
          <Kpi label={`Peor ${periods.length || 24} meses`} value={worst24 ? String(worst24) : '—'} hint={situationText(worst24 || null)} tone={worst24 || null} />
          <Kpi label="Deuda total" value={formatARS(Number(report.totalDebt ?? 0))} />
          <Kpi label="Entidades" value={String(report.entitiesCount ?? 0)} />
          <Kpi label="Cheques rech." value={String(checks)} tone={checks ? 5 : null} />
        </div>
        <p className="bcra-note">
          Consulta al BCRA del {docDate(consulted)}. Score interno de UNICRÉDITOS: no es Veraz ni Nosis ni reemplaza lo
          informado por el BCRA.
        </p>
      </DocumentSection>

      <DocumentSection number="03" title="Central de Deudores del BCRA">
        {extract ? (
          <BcraExtractDocument snapshot={extract} />
        ) : (
          <p className="bcra-doc-empty">
            No hay detalle de entidades guardado en esta consulta. El resumen refleja los totales al momento de consultar.
          </p>
        )}
      </DocumentSection>

      <DocumentFooter
        documentId={report.id}
        extra={`Informe confidencial para evaluación crediticia de ${BRAND.legalName} (CUIT ${branding.cuit ?? legalCuitLabel()}). Fuente: Central de Deudores del BCRA y procesos internos de UNICRÉDITOS. El titular puede ejercer sus derechos de acceso y rectificación ante el BCRA y ante ${BRAND.privacyEmail}. Prohibida su cesión a terceros no autorizados.`}
      />
    </DocumentSheet>
  )
}
