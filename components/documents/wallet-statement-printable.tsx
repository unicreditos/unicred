import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { formatDateTime } from '@/lib/format'
import { docDate, docCuil } from '@/lib/document-format'
import { parseMovementNote, cleanNoteText } from '@/lib/wallet/display'
import { formatMoney } from '@/lib/wallet/ledger'
import { isCredit, movementLabel } from '@/lib/wallet/queries'

export type StatementData = {
  number: string
  holder: string
  cuil: string | null
  alias: string
  cvu: string
  from: Date
  to: Date
  openingBalance: string
  closingBalance: string
  credits: string
  debits: string
  /** Solo asientos acreditados; `balance` es el saldo corrido calculado (saldo inicial + ingresos − egresos hasta ese asiento). */
  rows: Array<{ id: string; createdAt: Date; kind: string; direction: string; amount: string; balance: string; reference: string | null; notes: string | null }>
  pendingCount: number
  pendingAmount: string
  currentBalance: string
  truncated: boolean
}

/** Resumen de cuenta de la billetera para un período: saldo inicial, movimientos y saldo final. */
export function WalletStatementPrintable({ data }: { data: StatementData }) {
  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="extracto"
        title="Resumen de cuenta"
        subtitle="Billetera virtual UNICRÉDITOS"
        number={data.number}
        issuedAt={docDate(new Date())}
        status="Emitido"
        statusTone="neutral"
      />

      <DocumentSection number="01" title="Titular y cuenta">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Titular" value={data.holder} />
          <DocumentField label="CUIL" value={docCuil(data.cuil)} mono />
          <DocumentField label="Alias" value={data.alias} mono />
          <DocumentField label="CVU" value={data.cvu} mono />
          <DocumentField label="Período" value={`${docDate(data.from)} al ${docDate(new Date(data.to.getTime() - 1))}`} />
          <DocumentField label="Moneda" value="Pesos argentinos (ARS)" />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Resumen del período">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Saldo inicial" value={formatMoney(data.openingBalance)} mono />
          <DocumentField label="Ingresos" value={formatMoney(data.credits)} mono />
          <DocumentField label="Egresos" value={formatMoney(data.debits)} mono />
          <DocumentField label="Saldo final" value={formatMoney(data.closingBalance)} mono />
          <DocumentField label="Saldo disponible hoy" value={formatMoney(data.currentBalance)} mono />
          <DocumentField label="Movimientos" value={String(data.rows.length)} mono />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="03" title="Movimientos">
        {data.rows.length === 0 ? (
          <p className="text-[11px] text-slate-500">No hubo movimientos en el período.</p>
        ) : (
          <table className="doc-table">
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Referencia</th>
                <th className="num">Importe</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>
                    {movementLabel(m.kind)}
                    {cleanNoteText(movementLabel(m.kind), parseMovementNote(m.notes).text) ? <div className="text-[11px] text-slate-500">{cleanNoteText(movementLabel(m.kind), parseMovementNote(m.notes).text)}</div> : null}
                  </td>
                  <td className="font-mono">{m.reference ?? '—'}</td>
                  <td className="num">
                    {isCredit(m.direction) ? '+' : '−'} {formatMoney(m.amount)}
                  </td>
                  <td className="num">{formatMoney(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.pendingCount > 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            No se incluyen {data.pendingCount} operación{data.pendingCount === 1 ? '' : 'es'} pendiente{data.pendingCount === 1 ? '' : 's'} de acreditación ({formatMoney(data.pendingAmount)}): no afectan el saldo hasta que se acrediten.
          </p>
        ) : null}
        {data.truncated ? <p className="text-[11px] text-slate-500">Se muestran los primeros 2.000 movimientos del período. Acotá las fechas para ver el resto.</p> : null}
      </DocumentSection>

      <DocumentFooter documentId={data.number} extra="Saldo final = saldo inicial + ingresos − egresos del período. Refleja los asientos acreditados del libro de la billetera a la fecha de emisión." />
    </DocumentSheet>
  )
}
