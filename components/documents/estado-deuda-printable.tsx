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
import { LEGAL_REVISION } from '@/lib/legal/copy'
import type { ContractDocData } from '@/lib/legal/types'

export function EstadoDeudaPrintable({ contract }: { contract: ContractDocData }) {
  const paid = contract.installments.filter((i) => i.status === 'paid')
  const overdue = contract.installments.filter((i) => i.status === 'overdue')
  const pending = contract.installments.filter((i) => i.status !== 'paid')
  const paidAmt = paid.reduce((s, i) => s + Number(i.amount), 0)
  const pendingAmt = pending.reduce((s, i) => s + Number(i.amount), 0)
  const overdueAmt = overdue.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="estado"
        title="Estado de deuda"
        subtitle="Certificación de saldo emitida por el acreedor"
        number={`ED-${docShortId(contract.id)}`}
        issuedAt={docDate(new Date())}
        status={overdue.length ? 'Con mora' : pending.length ? 'Vigente' : 'Cancelado'}
        statusTone={overdue.length ? 'danger' : pending.length ? 'warn' : 'ok'}
      />

      <DocumentSection number="01" title="Crédito">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Deudor" value={contract.customer?.name ?? '—'} />
          <DocumentField label="CUIL" value={contract.customer?.cuil ?? '—'} mono />
          <DocumentField label="Contrato" value={`CTR-${docShortId(contract.id)}`} mono />
          <DocumentField label="Capital originado" value={formatARSDecimal(contract.loan.principal)} mono />
          <DocumentField label="Total del plan" value={formatARSDecimal(contract.loan.totalAmount)} mono />
          <DocumentField label="Pagado" value={formatARSDecimal(paidAmt)} mono />
          <DocumentField label="Pendiente" value={formatARSDecimal(pendingAmt)} mono />
          <DocumentField label="Vencido" value={formatARSDecimal(overdueAmt)} mono />
          <DocumentField label="Cuotas impagas" value={String(pending.length)} />
          <DocumentField label="Refinanciaciones" value={`${contract.refinanceCount ?? 0} / 2`} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Detalle">
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
            {contract.installments.map((row) => (
              <tr key={row.number}>
                <td className="font-mono">{String(row.number).padStart(2, '0')}</td>
                <td>{docDate(row.dueDate)}</td>
                <td className="num">{formatARSDecimal(row.amount)}</td>
                <td>{installmentStatusLabel(row.status)}</td>
              </tr>
            ))}
            {!contract.installments.length ? (
              <tr>
                <td colSpan={4}>Sin cronograma emitido.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </DocumentSection>

      <DocumentSection number="03" title="Certificación del acreedor">
        <p className="text-[13px] leading-relaxed text-slate-700">
          {BRAND.legalName}, en su carácter de acreedor de UNICRÉDITOS, certifica que el saldo
          pendiente según libros al {docDate(new Date())} es de{' '}
          <strong>{formatARSDecimal(pendingAmt)}</strong>, sin perjuicio de punitorios, costas e
          intereses que continúen devengándose hasta el efectivo pago. Este estado no implica
          quita, espera ni novación.
        </p>
      </DocumentSection>

      <DocumentFooter documentId={`ED-${contract.id}`} extra={`Documento emitido para el deudor, cesionarios y, en su caso, autoridad judicial. Revisión ${LEGAL_REVISION}.`} />
    </DocumentSheet>
  )
}
