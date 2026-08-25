import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { BRAND, legalCuitLabel } from '@/lib/brand'
import { docDate, docShortId, installmentStatusLabel } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import type { IntimableRow } from '@/lib/legal/mora'
import { amountInWords } from '@/lib/legal/money-words'
import type { ContractDocData } from '@/lib/legal/types'

export function IntimacionPrintable({
  contract,
  items,
  noticeNumber,
  issuedAt,
}: {
  contract: ContractDocData
  items: IntimableRow[]
  noticeNumber?: string
  issuedAt?: Date | string
}) {
  const claim = items.reduce((sum, row) => sum + Number(row.amount), 0)
  const issued = issuedAt ?? new Date()

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="intimacion"
        title="Intimación de pago"
        subtitle="Solo cuotas con 30 días o más de atraso · no incluye cuotas al día"
        number={noticeNumber || `INT-${docShortId(contract.id)}`}
        issuedAt={docDate(issued)}
        status="Extrajudicial"
        statusTone="danger"
      />

      <DocumentSection number="01" title="Destinatario">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Titular" value={contract.customer?.name ?? '—'} />
          <DocumentField label="DNI" value={contract.customer?.dni ?? '—'} mono />
          <DocumentField label="CUIL" value={contract.customer?.cuil ?? '—'} mono />
          <DocumentField label="Domicilio" value={contract.customer?.address ?? contract.customer?.city ?? '—'} />
          <DocumentField label="Localidad" value={[contract.customer?.city, contract.customer?.province].filter(Boolean).join(' · ') || '—'} />
          <DocumentField label="Email" value={contract.customer?.email ?? '—'} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Acreedor y operación">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Acreedor" value={BRAND.legalName} />
          <DocumentField label="Tipo societario" value={BRAND.legalForm} />
          <DocumentField label="CUIT" value={legalCuitLabel()} mono />
          <DocumentField label="Domicilio" value={BRAND.address} />
          <DocumentField label="Préstamo" value={contract.loanId} mono />
          <DocumentField label="Contrato" value={`CTR-${docShortId(contract.id)}`} mono />
          <DocumentField label="Pagaré" value={`PAG-${docShortId(contract.id)}`} mono />
          <DocumentField label="Capital originado" value={formatARSDecimal(contract.loan.principal)} mono />
          <DocumentField
            label="Refinanciaciones"
            value={`${contract.refinanceCount ?? 0} / 2`}
          />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="03" title="Cuotas intimadas">
        <p className="mb-3 text-[12px] text-slate-600">
          Únicamente las cuotas vencidas hace 30 días o más. Las cuotas pendientes o con menos de 30 días de atraso no se intiman.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Vencimiento</th>
              <th>Días de atraso</th>
              <th className="num">Importe</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.number}>
                <td>{String(row.number).padStart(2, '0')}</td>
                <td>{docDate(row.dueDate)}</td>
                <td>{row.daysLate}</td>
                <td className="num">{formatARSDecimal(row.amount)}</td>
                <td>{installmentStatusLabel(row.status === 'pending' ? 'overdue' : row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocumentSection>

      <DocumentSection number="04" title="Importe intimado">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Cuotas intimadas" value={String(items.length)} />
          <DocumentField label="Total" value={formatARSDecimal(claim)} mono />
          <DocumentField label="En letras" value={amountInWords(claim)} />
        </DocumentFieldGrid>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
          Se intima el pago de las cuotas de esta tabla, más punitorios, costas y accesorios hasta el efectivo ingreso.
          No se exige el saldo de cuotas futuras que todavía no vencieron.
        </p>
      </DocumentSection>

      <DocumentSection number="05" title="Plazo">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Punto</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Pagar el importe intimado dentro de los cinco (5) días de recibida esta comunicación, por los canales UNICRÉDITOS.</td>
            </tr>
            <tr>
              <td>2</td>
              <td>La mora se produjo por el vencimiento. Esta intimación no sustituye esa mora ni impide la caducidad de plazos del contrato.</td>
            </tr>
            <tr>
              <td>3</td>
              <td>
                Vencido el plazo sin pago, el acreedor podrá exigir el saldo, ejecutar el pagaré,
                informar a bases de informes comerciales y, solo si el régimen aplicable lo
                habilita, a la Central de Deudores del BCRA, y promover acciones, con costas a
                cargo del deudor.
              </td>
            </tr>
            <tr>
              <td>4</td>
              <td>Un pago parcial no implica quita ni espera, salvo convenio escrito. La refinanciación, si corresponde, se acuerda aparte y tiene un tope de dos veces por crédito.</td>
            </tr>
          </tbody>
        </table>
      </DocumentSection>

      <DocumentSection number="06" title="Firma del acreedor">
        <DocumentFieldGrid cols={2}>
          <DocumentField label="Lugar y fecha" value={`${BRAND.city}, ${docDate(issued)}`} />
          <DocumentField label="CUIT" value={legalCuitLabel()} mono />
        </DocumentFieldGrid>
        <div className="mt-10 max-w-sm border-t border-slate-400 pt-2">
          <p className="text-sm font-semibold">{BRAND.legalName}</p>
          <p className="text-xs text-slate-500">Acreedor · UNICRÉDITOS</p>
          <p className="text-xs text-slate-500">{BRAND.address}</p>
        </div>
      </DocumentSection>

      <DocumentFooter
        documentId={noticeNumber || `INT-${contract.id}`}
        extra="Comunicación extrajudicial. Conservar constancia de envío. No se emite si el titular está al día o la mora tiene menos de 30 días."
      />
    </DocumentSheet>
  )
}
