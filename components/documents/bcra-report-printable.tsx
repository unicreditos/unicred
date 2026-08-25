import { BcraExtract } from '@/components/unicred/bcra-extract'
import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { snapshotFromStored } from '@/lib/bcra'
import { BRAND, legalCuitLabel } from '@/lib/brand'
import { docDate, docDateTime } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import { cn } from '@/lib/utils'

type BCRAReportData = {
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

function scoreMeta(score: number | null | undefined) {
  if (!score) return { label: 'Sin score', tone: 'text-slate-500', width: 0 }
  if (score >= 720) return { label: 'Excelente', tone: 'text-emerald-700', width: Math.min(100, (score / 850) * 100) }
  if (score >= 640) return { label: 'Bueno', tone: 'text-emerald-800', width: Math.min(100, (score / 850) * 100) }
  if (score >= 560) return { label: 'Regular', tone: 'text-amber-700', width: Math.min(100, (score / 850) * 100) }
  return { label: 'Riesgo alto', tone: 'text-red-700', width: Math.min(100, (score / 850) * 100) }
}

function situationMeta(value: number | null | undefined) {
  const map: Record<number, string> = {
    1: '1 · Normal',
    2: '2 · Riesgo bajo',
    3: '3 · Riesgo medio',
    4: '4 · Riesgo medio-alto',
    5: '5 · Irregular',
    6: '6 · Irrecuperable',
  }
  if (!value) return 'No informada'
  return map[value] ?? String(value)
}

export function BCRAReportPrintable({ report }: { report: BCRAReportData }) {
  const score = scoreMeta(report.scoreAtGeneration)
  const extract = snapshotFromStored(report.fullReportData, report.customer?.cuil ?? undefined)
  const branding = report.branding ?? {}

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="informe"
        title={branding.reportType ?? 'Informe de situación crediticia'}
        subtitle="Consulta a Central de Deudores del BCRA y score UNICRÉDITOS"
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
          <DocumentField label="Correo" value={report.customer?.email ?? '—'} />
          <DocumentField label="Provincia" value={report.customer?.province ?? '—'} />
          <DocumentField label="Localidad" value={report.customer?.city ?? '—'} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Score UNICRÉDITOS">
        <div className="border border-slate-200 bg-slate-50 px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Puntaje al momento de emisión
              </p>
              <p className={cn('doc-amount mt-1 font-mono font-semibold tracking-tight', score.tone)}>
                {report.scoreAtGeneration ?? '—'}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                {score.label}
              </p>
            </div>
            <p className="max-w-xs text-[11px] leading-relaxed text-slate-600">
              El score UNICRÉDITOS es una evaluación interna. No es el “score Veraz” ni reemplaza la
              situación informada por el BCRA.
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden bg-slate-200">
            <div className="h-full bg-slate-800" style={{ width: `${score.width}%` }} />
          </div>
          <div className="mt-1 doc-score-scale font-mono text-[10px] text-slate-500">
            <span>300</span>
            <span>560</span>
            <span>640</span>
            <span>720</span>
            <span>850</span>
          </div>
        </div>
      </DocumentSection>

      <DocumentSection number="03" title="Resumen BCRA">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Peor situación" value={situationMeta(report.worstSituation)} />
          <DocumentField label="Deuda consolidada" value={formatARSDecimal(report.totalDebt ?? 0)} mono />
          <DocumentField label="Entidades" value={String(report.entitiesCount ?? 0)} />
          <DocumentField
            label="Cheques rechazados"
            value={report.hasRejectedChecks ? 'Sí' : 'No'}
          />
          <DocumentField
            label="Consulta BCRA"
            value={docDate((report.fullReportData as { consultedAt?: string } | null)?.consultedAt ?? report.createdAt)}
          />
          <DocumentField label="Entidad consultora" value={branding.company ?? BRAND.legalName} />
        </DocumentFieldGrid>
      </DocumentSection>

      {extract ? (
        <DocumentSection number="04" title="Extracto Central de Deudores">
          <div className="doc-extract">
            <BcraExtract snapshot={extract} variant="document" />
          </div>
        </DocumentSection>
      ) : (
        <DocumentSection number="04" title="Extracto Central de Deudores">
          <p className="text-sm text-slate-600">
            No hay detalle de entidades almacenado en este informe. El resumen de la cláusula 3
            refleja los totales al momento de la consulta.
          </p>
        </DocumentSection>
      )}

      <DocumentSection number="05" title="Alcance">
        <p className="text-[12.5px] leading-relaxed text-slate-600">
          Informe confidencial para evaluación crediticia de {BRAND.legalName} (CUIT{' '}
          {branding.cuit ?? legalCuitLabel()}). La información proviene de la Central de Deudores
          del BCRA y de procesos internos de UNICRÉDITOS. El titular puede ejercer derechos de acceso
          y rectificación ante el BCRA y ante {BRAND.privacyEmail}.
        </p>
      </DocumentSection>

      <DocumentFooter
        documentId={report.id}
        extra="Uso exclusivo del titular y de UNICRÉDITOS. Queda prohibida su cesión a terceros no autorizados."
      />
    </DocumentSheet>
  )
}
