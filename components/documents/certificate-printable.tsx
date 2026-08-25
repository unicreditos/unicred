import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { BRAND } from '@/lib/brand'
import { docDate, docShortId, installmentStatusLabel } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import type { LoanCertificateData } from '@/lib/legal/loan-pack'

const COPY = {
  solvencia: {
    title: 'Certificado de solvencia',
    subtitle: 'El titular se encuentra al día con UNICRÉDITOS a la fecha de emisión',
    number: (id: string) => `SOL-${docShortId(id)}`,
    extra: 'No implica calificación oficial BCRA ni garantía de crédito futuro. Refleja únicamente la cartera UNICRÉDITOS.',
  },
  libre_deuda: {
    title: 'Constancia de libre deuda',
    subtitle: 'El crédito identificado quedó cancelado. No resta saldo exigible',
    number: (id: string) => `LD-${docShortId(id)}`,
    extra: 'Libera el pagaré vinculado a esta operación. No cubre otros créditos del mismo titular.',
  },
  cancelacion: {
    title: 'Liquidación de cancelación anticipada',
    subtitle: 'Capital remanente y deducción de intereses no devengados · sistema francés',
    number: (id: string) => `CAN-${docShortId(id)}`,
    extra: 'El prepago extingue las cuotas futuras. Se cobran intereses ya devengados; se deducen los no corridos.',
  },
} as const

export function CertificatePrintable({ data }: { data: LoanCertificateData }) {
  const copy = COPY[data.kind]
  const paidAmt = data.installments.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind={data.kind}
        title={copy.title}
        subtitle={copy.subtitle}
        number={copy.number(data.loanId)}
        issuedAt={docDate(data.issuedAt)}
        status={data.kind === 'libre_deuda' ? 'Cancelado' : data.kind === 'cancelacion' ? 'Liquidación' : 'Al día'}
        statusTone="ok"
      />

      <DocumentSection number="01" title="Titular y crédito">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Deudor" value={data.customer?.name ?? '—'} />
          <DocumentField label="CUIL" value={data.customer?.cuil ?? '—'} mono />
          <DocumentField label="DNI" value={data.customer?.dni ?? '—'} mono />
          <DocumentField label="Préstamo" value={data.loanId} mono />
          <DocumentField label="Contrato" value={data.contractId ? `CTR-${docShortId(data.contractId)}` : '—'} mono />
          <DocumentField label="Capital originado" value={formatARSDecimal(data.loan.principal)} mono />
          <DocumentField label="Plazo" value={`${data.loan.term} cuotas`} />
          <DocumentField label="TNA" value={data.loan.tna != null ? `${data.loan.tna}%` : '—'} />
          <DocumentField label="Pagado a la fecha" value={formatARSDecimal(paidAmt)} mono />
        </DocumentFieldGrid>
      </DocumentSection>

      {data.kind === 'cancelacion' ? (
        <DocumentSection number="02" title="Deducción de intereses">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Saldo contractual (cuotas impagas)" value={formatARSDecimal(data.settlement.contractualRemaining)} mono />
            <DocumentField label="Capital remanente" value={formatARSDecimal(data.settlement.remainingCapital)} mono />
            <DocumentField label="Intereses no devengados" value={formatARSDecimal(data.settlement.interestDeduction)} mono />
            <DocumentField label="Importe a cancelar" value={formatARSDecimal(data.settlement.settlementAmount)} mono />
            <DocumentField label="Cuotas ya pagadas" value={String(data.settlement.paidCount)} />
            <DocumentField label="Cuotas que se extinguen" value={String(data.settlement.unpaidCount)} />
          </DocumentFieldGrid>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
            Sistema francés: al adelantar o cancelar, se abona el capital pendiente. Los intereses de las cuotas
            futuras no corridas se deducen. {BRAND.legalName} no cobra un recargo adicional de cancelación en esta liquidación.
          </p>
        </DocumentSection>
      ) : (
        <DocumentSection number="02" title="Declaración">
          <p className="text-[13px] leading-relaxed text-slate-700">
            {data.kind === 'libre_deuda'
              ? `${BRAND.legalName}, como acreedor de UNICRÉDITOS, certifica que el préstamo ${data.loanId} no registra saldo de capital, intereses ni punitorios exigibles a la fecha de emisión.`
              : `${BRAND.legalName} certifica que el titular no registra cuotas vencidas impagas en el préstamo ${data.loanId} a la fecha de emisión.`}
          </p>
        </DocumentSection>
      )}

      <DocumentSection number="03" title="Cronograma">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Vencimiento</th>
              <th className="num">Importe</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.installments.map((row) => (
              <tr key={row.number}>
                <td>{row.number}</td>
                <td>{docDate(row.dueDate)}</td>
                <td className="num">{formatARSDecimal(row.amount)}</td>
                <td>{installmentStatusLabel(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocumentSection>

      <DocumentFooter documentId={`${data.kind}:${data.loanId}`} extra={copy.extra} />
    </DocumentSheet>
  )
}
