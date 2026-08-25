import { Logo } from '@/components/brand'
import { BRAND, legalCuitLabel, publicBrandWebsite } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export type DocumentKind =
  | 'contrato'
  | 'recibo'
  | 'informe'
  | 'pagare'
  | 'liquidacion'
  | 'estado'
  | 'intimacion'
  | 'solvencia'
  | 'libre_deuda'
  | 'cancelacion'
  | 'constancia'

const KIND_LABEL: Record<DocumentKind, string> = {
  contrato: 'Contrato',
  recibo: 'Comprobante',
  informe: 'Informe',
  pagare: 'Pagaré',
  liquidacion: 'Liquidación',
  estado: 'Estado de deuda',
  intimacion: 'Intimación',
  solvencia: 'Solvencia',
  libre_deuda: 'Libre deuda',
  cancelacion: 'Cancelación',
  constancia: 'Constancia',
}

export function DocumentSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article className={cn('document-sheet print-page', className)}>
      {children}
    </article>
  )
}

export function DocumentLetterhead({
  kind,
  title,
  subtitle,
  number,
  issuedAt,
  validUntil,
  validUntilLabel = 'Vigencia',
  status,
  statusTone = 'neutral',
}: {
  kind: DocumentKind
  title: string
  subtitle?: string
  number: string
  issuedAt: string
  validUntil?: string
  /** Etiqueta del campo de fecha (p. ej. "Vencimiento del plan" vs "Oferta válida hasta"). */
  validUntilLabel?: string
  status?: string
  statusTone?: 'ok' | 'warn' | 'danger' | 'neutral'
}) {
  const tone =
    statusTone === 'ok'
      ? 'doc-stamp-ok'
      : statusTone === 'warn'
        ? 'doc-stamp-warn'
        : statusTone === 'danger'
          ? 'doc-stamp-danger'
          : 'doc-stamp-neutral'

  const site = publicBrandWebsite()
  const phone = BRAND.phone?.trim()

  return (
    <header className="doc-letterhead">
      <div className="doc-letterhead-bar">
        <span>UNICRÉDITOS · {BRAND.legalName}</span>
        <span className="doc-letterhead-kind">{KIND_LABEL[kind]}</span>
      </div>

      <div className="doc-letterhead-body">
        <div className="doc-letterhead-brand">
          <div className="doc-logo-box">
            <Logo showText={false} />
          </div>
          <div className="doc-letterhead-copy">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {BRAND.company} · Unidad de créditos
            </p>
            <p className="text-[17px] font-semibold leading-snug text-slate-900">{BRAND.legalName}</p>
            <p className="text-[11px] leading-snug text-slate-600">
              {BRAND.legalForm}
              <span className="mx-1.5 text-slate-300">·</span>
              CUIT {legalCuitLabel()}
              <span className="mx-1.5 text-slate-300">·</span>
              IIBB {BRAND.iibb}
            </p>
            <p className="text-[11px] leading-snug text-slate-600">{BRAND.address}</p>
            <p className="text-[11px] leading-snug text-slate-600">
              {site}
              <span className="mx-1.5 text-slate-300">·</span>
              {BRAND.supportEmail}
              {phone ? (
                <>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {phone}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="doc-meta">
          {status ? <span className={cn('doc-stamp', tone)}>{status}</span> : null}
          <p className="doc-meta-title">{title}</p>
          {subtitle ? <p className="text-xs leading-snug text-slate-600">{subtitle}</p> : null}
          <p className="font-mono text-sm font-semibold tracking-tight text-slate-900">{number}</p>
          <p className="text-[11px] leading-snug text-slate-600">Emitido: {issuedAt}</p>
          {validUntil ? (
            <p className="text-[11px] leading-snug text-slate-600">
              {validUntilLabel}: {validUntil}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function DocumentSection({
  number,
  title,
  children,
}: {
  number?: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="doc-section">
      <h2 className="doc-section-title">
        {number ? <span className="doc-section-num">{number}</span> : null}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}

export function DocumentFieldGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn('doc-field-grid', cols === 3 && 'doc-field-grid-3')}>{children}</div>
}

export function DocumentField({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="doc-field">
      <div className="doc-field-label">{label}</div>
      <div className={cn('doc-field-value', mono && 'font-mono tabular-nums')}>{value || '—'}</div>
    </div>
  )
}

export function DocumentFooter({
  documentId,
  extra,
}: {
  documentId: string
  extra?: string
}) {
  return (
    <footer className="doc-footer">
      <div>
        <p className="font-semibold text-slate-800">
          {BRAND.legalName} · UNICRÉDITOS
        </p>
        <p>
          {BRAND.iva} · {BRAND.iibbRegime} · IGJ {BRAND.igj} · constitución {BRAND.incorporated}.
          Documento electrónico. Firma digital conforme Ley 25.506. Comprobante o instrumento
          interno; no reemplaza factura electrónica AFIP cuando ésta corresponda.
        </p>
        {extra ? <p className="mt-1">{extra}</p> : null}
      </div>
      <div className="doc-footer-id">
        <p>Identificador</p>
        <p className="font-mono break-all">{documentId}</p>
        <p className="mt-1">{BRAND.domain}</p>
      </div>
    </footer>
  )
}
