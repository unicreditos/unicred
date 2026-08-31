import {
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { BRAND, legalCuitLabel } from '@/lib/brand'
import { contractStatusLabel, docDate, docDateTime, docShortId } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import { LEGAL_COPY, LEGAL_REVISION } from '@/lib/legal/copy'
import { amountInWords } from '@/lib/legal/money-words'
import type { ContractDocData } from '@/lib/legal/types'

export function PagarePrintable({ contract }: { contract: ContractDocData }) {
  const total = Number(contract.loan.totalAmount) || 0
  const lastDue = contract.installments.at(-1)?.dueDate ?? contract.expirationDate ?? contract.createdAt
  const nro = `PAG-${docShortId(contract.id)}`
  const accepted = Boolean(contract.acceptedAt)

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="pagare"
        title="Pagaré sin protesto"
        subtitle={LEGAL_COPY.pagareSubtitle}
        number={nro}
        issuedAt={docDate(contract.acceptedAt ?? contract.createdAt)}
        validUntil={docDate(lastDue)}
        validUntilLabel="Vencimiento"
        status={accepted ? 'Librado' : 'Pendiente de firma'}
        statusTone={accepted ? 'ok' : 'warn'}
      />

      <DocumentSection number="01" title="Promesa incondicional de pago">
        <div className="border-2 border-slate-900 px-5 py-6">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-900">
            Pagaré
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-slate-800">
            El {docDate(contract.acceptedAt ?? contract.createdAt)}, en {BRAND.city},{' '}
            <strong>{contract.customer?.name ?? '—'}</strong>, DNI {contract.customer?.dni ?? '—'},
            CUIL {contract.customer?.cuil ?? '—'}, en adelante el Librador, pagará{' '}
            <strong>sin protesto</strong> e incondicionalmente a la orden de{' '}
            <strong>{BRAND.legalName}</strong>, CUIT {legalCuitLabel()}, o a quien sus derechos
            represente, la suma de <strong>{formatARSDecimal(total)}</strong> (
            {amountInWords(total)}), en {BRAND.city}, el día <strong>{docDate(lastDue)}</strong>,
            por igual valor recibido en préstamo (mutuo).
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
            Lugar de pago: {BRAND.address}. Moneda: pesos argentinos de curso legal. Este pagaré
            se emite en garantía del contrato CTR-{docShortId(contract.id)}, préstamo{' '}
            <span className="font-mono">{contract.loanId}</span>, sin que ello importe
            novación. El tenedor puede exigir el saldo
            impago del préstamo (mutuo) y/o este título hasta la cancelación.
          </p>
        </div>
      </DocumentSection>

      <DocumentSection number="02" title="Cláusulas cambiarias">
        <ol className="doc-clauses">
          <li>
            <strong>Sin protesto.</strong> Queda dispensado el protesto (art. 50, Decreto-Ley
            5965/63). La falta de pago al vencimiento autoriza la acción cambiaria y la del
            contrato de préstamo (mutuo).
          </li>
          <li>
            <strong>Intereses.</strong> {LEGAL_COPY.punitorios} Este pagaré no devenga punitorios
            distintos de los del contrato de préstamo (mutuo).
          </li>
          <li>
            <strong>Endoso y cesión.</strong> El Acreedor puede endosar o ceder este pagaré. El
            Librador se obliga al pago frente a cualquier tenedor de buena fe.
          </li>
          <li>
            <strong>Firma electrónica.</strong> La aceptación del contrato de préstamo (mutuo) en
            UNICRÉDITOS importa el libramiento de este pagaré (Ley 25.506). Estado del expediente:{' '}
            {contractStatusLabel(contract.status)}
            {contract.acceptedAt ? ` · ${docDateTime(contract.acceptedAt)}` : ''}.
          </li>
        </ol>
      </DocumentSection>

      <DocumentSection number="03" title="Librador">
        <div className="doc-split gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Firma del librador
            </p>
            <div className="mt-10 border-b border-slate-400" />
            <p className="mt-2 text-sm font-semibold">{contract.customer?.name ?? '—'}</p>
            <p className="font-mono text-xs text-slate-500">
              DNI {contract.customer?.dni ?? '—'} · CUIL {contract.customer?.cuil ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Beneficiario
            </p>
            <div className="mt-10 border-b border-slate-400" />
            <p className="mt-2 text-sm font-semibold">{BRAND.legalName}</p>
            <p className="text-xs text-slate-500">CUIT {legalCuitLabel()} · UNICRÉDITOS</p>
          </div>
        </div>
      </DocumentSection>

      <DocumentFooter
        documentId={nro}
        extra={`Instrumento accesorio del contrato de préstamo (mutuo). Revisión ${LEGAL_REVISION}. La ejecución judicial sigue las formalidades del soporte (electrónico o papel) y la ley vigente.`}
      />
    </DocumentSheet>
  )
}
