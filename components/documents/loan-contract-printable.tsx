import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { BRAND, legalCuitLabel, legalPartyLine } from '@/lib/brand'
import {
  contractStatusLabel,
  docDate,
  docDateTime,
  docShortId,
  installmentStatusLabel,
} from '@/lib/document-format'
import { formatARSDecimal, formatCBU, formatCVU, formatPercent } from '@/lib/finance'
import { LEGAL_COPY, LEGAL_REVISION } from '@/lib/legal/copy'
import { amountInWords } from '@/lib/legal/money-words'
import type { ContractAccount, ContractDocData, InstallmentDoc } from '@/lib/legal/types'

export type { ContractAccount, ContractDocData, InstallmentDoc }

function money(value: string | number | null | undefined) {
  return formatARSDecimal(value ?? 0)
}

function rate(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  return formatPercent(value)
}

function accountTypeLabel(value?: string | null) {
  if (!value) return '—'
  const v = value.toLowerCase()
  if (v === 'cbu') return 'CBU'
  if (v === 'cvu') return 'CVU'
  return value.replace(/_/g, ' ')
}

/** CUIL/CUIT legible; evita concatenar dígitos de campos vecinos en impresión/OCR. */
function formatCuilDigits(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  if (digits.length !== 11) return value?.trim() || '—'
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

export function LoanContractPrintable({ contract }: { contract: ContractDocData }) {
  const account = contract.bankAccount ?? contract.disbursementAccount ?? null
  const product =
    contract.templateName === 'prestamo_comercial_ars' || contract.loan.type === 'comercio'
      ? LEGAL_COPY.contractSubtitleComercial
      : LEGAL_COPY.contractSubtitlePersonal
  const status = contractStatusLabel(contract.status)
  const statusTone =
    contract.status === 'accepted' ? 'ok' : contract.status === 'rejected' ? 'danger' : 'warn'
  const principal = Number(contract.loan.principal) || 0
  const total = Number(contract.loan.totalAmount) || 0
  const interest = Math.round((total - principal) * 100) / 100
  const domicilio =
    [contract.customer?.address, contract.customer?.city, contract.customer?.province]
      .filter(Boolean)
      .join(', ') || 'el denunciado en su perfil UNICRÉDITOS'
  const pagareNro = `PAG-${docShortId(contract.id)}`
  const lastDue = contract.installments.at(-1)?.dueDate
  // "Vigencia" del plan = última cuota (no la ventana de 30 días de la oferta).
  const planEnd =
    lastDue ??
    (() => {
      const start = new Date(contract.createdAt)
      if (Number.isNaN(start.getTime())) return null
      const end = new Date(start)
      end.setMonth(end.getMonth() + Math.max(1, Number(contract.loan.term) || 1))
      return end
    })()

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="contrato"
        title={LEGAL_COPY.contractTitle}
        subtitle={product}
        number={`CTR-${docShortId(contract.id)} · v${contract.version}`}
        issuedAt={docDate(contract.createdAt)}
        validUntil={planEnd ? docDate(planEnd) : undefined}
        validUntilLabel="Vencimiento del plan"
        status={status}
        statusTone={statusTone}
      />

      <DocumentSection number="01" title="Comparecencia y capacidad">
        <p className="text-[13px] leading-relaxed text-slate-700">
          En la Ciudad Autónoma de Buenos Aires, entre <strong>{legalPartyLine()}</strong>, inscripta
          ante IGJ bajo {BRAND.igj}, IVA {BRAND.iva}, en adelante el <strong>Prestamista</strong> o
          el <strong>Acreedor</strong>, titular de la marca UNICRÉDITOS; y{' '}
          <strong>{contract.customer?.name ?? '—'}</strong>, DNI {contract.customer?.dni ?? '—'},
          CUIL {contract.customer?.cuil ?? '—'}, con domicilio en {domicilio}, en adelante el{' '}
          <strong>Prestatario</strong> o el <strong>Deudor</strong>, se celebra este{' '}
          <strong>contrato de préstamo</strong> en la modalidad de mutuo con interés (arts. 1525 y
          ss. del Código Civil y Comercial de la Nación). {LEGAL_COPY.mutuoExplain} El Prestatario
          declara haber leído íntegramente este instrumento antes de aceptarlo.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
          El Prestatario declara ser mayor de edad, tener capacidad para contratar, obrar de
          contado propio y no estar inhibido, fallido ni concursado. Si actúa por una persona
          jurídica, declara facultades suficientes y responde también en forma personal por las
          declaraciones falsas.
        </p>
      </DocumentSection>

      <DocumentSection number="02" title="Partes">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Acreedor / Prestamista
            </p>
            <DocumentFieldGrid>
              <DocumentField label="Razón social" value={BRAND.legalName} />
              <DocumentField label="Tipo" value={BRAND.legalForm} />
              <DocumentField label="CUIT" value={legalCuitLabel()} mono />
              <DocumentField label="IIBB" value={BRAND.iibb} mono />
              <DocumentField label="Domicilio especial" value={BRAND.address} />
              <DocumentField label="Marca" value="UNICRÉDITOS" />
            </DocumentFieldGrid>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Deudor / Prestatario
            </p>
            <DocumentFieldGrid>
              <DocumentField label="Nombre" value={contract.customer?.name ?? '—'} />
              <DocumentField label="CUIL" value={contract.customer?.cuil ?? '—'} mono />
              <DocumentField label="DNI" value={contract.customer?.dni ?? '—'} mono />
              <DocumentField label="Domicilio" value={domicilio} />
              <DocumentField label="Correo" value={contract.customer?.email ?? '—'} />
              <DocumentField label="Teléfono" value={contract.customer?.phone ?? '—'} />
            </DocumentFieldGrid>
          </div>
        </div>
      </DocumentSection>

      <DocumentSection number="03" title="Objeto y capital">
        <p className="text-[13px] leading-relaxed text-slate-700">
          El Prestamista entrega en mutuo (préstamo de dinero) al Prestatario la suma de{' '}
          <strong>{money(principal)}</strong> ({amountInWords(principal)}), en moneda de curso
          legal de la República Argentina, en carácter de capital. El Prestatario se obliga a
          restituir ese capital, más intereses compensatorios, accesorios, impuestos y gastos
          que resulten de este instrumento y de la liquidación de cada cuota.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
          Destino declarado: <strong>{contract.loan.purpose ?? 'libre disponibilidad'}</strong>.
          El incumplimiento del destino no libera al Deudor ni impide al Acreedor exigir el
          saldo. {LEGAL_COPY.nonBank}
        </p>
      </DocumentSection>

      <DocumentSection number="04" title="Costo del crédito">
        <table className="doc-table">
          <tbody>
            <tr>
              <td>Capital mutuado (préstamo)</td>
              <td className="num font-semibold">{money(contract.loan.principal)}</td>
            </tr>
            <tr>
              <td>Plazo</td>
              <td className="num">{contract.loan.term} cuotas mensuales y consecutivas</td>
            </tr>
            <tr>
              <td>Tasa efectiva mensual (TEM)</td>
              <td className="num">{rate(contract.loan.monthlyRate)}</td>
            </tr>
            <tr>
              <td>Tasa nominal anual (TNA)</td>
              <td className="num">{rate(contract.loan.tna)}</td>
            </tr>
            <tr>
              <td>Costo financiero total (CFT)</td>
              <td className="num">{rate(contract.loan.cft)}</td>
            </tr>
            <tr>
              <td>Cuota teórica (sistema francés)</td>
              <td className="num font-semibold">{money(contract.loan.installmentAmount)}</td>
            </tr>
            <tr>
              <td>Intereses compensatorios del plan</td>
              <td className="num">{money(interest)}</td>
            </tr>
            <tr className="total">
              <td>Total a reintegrar según plan</td>
              <td className="num">{money(contract.loan.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">{LEGAL_COPY.cftContractNote}</p>
      </DocumentSection>

      <DocumentSection number="05" title="Desembolso y cuenta de acreditación">
        <p className="mb-3 text-[13px] leading-relaxed text-slate-700">
          El capital se acreditará en la cuenta de titularidad del Prestatario dentro de los dos
          (2) días hábiles posteriores a la aceptación, sujeto a tesorería, validación de la
          cuenta y ausencia de alertas de fraude o ALA/FT. El Prestamista no gira a cuentas de
          terceros. La acreditación libera al Prestamista de la obligación de entrega.
        </p>
        {account ? (
          <DocumentFieldGrid>
            <DocumentField label="Entidad" value={account.bankName ?? '—'} />
            <DocumentField label="Tipo" value={accountTypeLabel(account.accountType)} />
            {account.cbu ? <DocumentField label="CBU" value={formatCBU(account.cbu)} mono /> : null}
            {account.cvu ? <DocumentField label="CVU" value={formatCVU(account.cvu)} mono /> : null}
            {account.alias ? <DocumentField label="Alias" value={account.alias} mono /> : null}
            <DocumentField label="Titular" value={account.holderName ?? '—'} />
            <DocumentField
              label="CUIL titular"
              value={formatCuilDigits(account.holderCuil)}
              mono
            />
          </DocumentFieldGrid>
        ) : (
          <p className="text-sm text-slate-600">
            El Prestatario deberá declarar CBU o CVU de su titularidad antes del desembolso.
          </p>
        )}
      </DocumentSection>

      <DocumentSection number="06" title="Amortización, vencimientos e imputación">
        <p className="mb-3 text-[13px] leading-relaxed text-slate-700">
          El reintegro se hace por el sistema francés de cuota teórica fija. Cada vencimiento
          es el del cronograma. Si cae en día inhábil, se traslada al hábil inmediato
          posterior, sin que ello implique espera gratuita. El pago se imputa, en este orden:
          costas y gastos, punitorios, intereses compensatorios, capital. El Prestamista puede
          compensar con créditos que el Prestatario tenga contra él.
        </p>
        {contract.installments.length === 0 ? (
          <p className="text-sm text-slate-600">
            El cronograma detallado se emite al firmar el contrato o al acreditar el capital. La
            cuota teórica y el CFT de la sección 04 ya forman parte de este acuerdo.
          </p>
        ) : (
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
                  <td className="num font-mono">{money(row.amount)}</td>
                  <td>{installmentStatusLabel(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocumentSection>

      <DocumentSection number="07" title="Mora, punitorios y caducidad">
        <ol className="doc-clauses">
          <li>
            <strong>Mora automática.</strong> El solo vencimiento produce mora de pleno derecho,
            sin interpelación (art. 886 CCCN), sin perjuicio de la intimación que el Acreedor
            pueda cursar.
          </li>
          <li>
            <strong>Punitorios.</strong> El sistema no liquida ni capitaliza punitorios de
            oficio. Si se aplican, la administración los liquidará e informará por separado, sin
            capitalización ilícita. Hasta entonces solo se exige el importe de la cuota vencida.
          </li>
          <li>
            <strong>Caducidad de plazos.</strong> El Acreedor puede declarar caducos los plazos y
            exigir el saldo luego de intimación formal sobre cuotas con al menos treinta días de
            atraso, o si el Deudor da información falsa, es inhibido, fallido o concursado, usa
            la cuenta de un tercero o incumple KYC.
          </li>
          <li>
            <strong>Información crediticia.</strong> {LEGAL_COPY.bcraReporteShort}
          </li>
          <li>
            <strong>Costas.</strong> El Deudor soporta gastos razonables de cobranza,
            extrajudiciales y judiciales, incluidos honorarios, si la mora le es imputable.
          </li>
        </ol>
      </DocumentSection>

      <DocumentSection number="08" title="Pagaré">
        <p className="text-[13px] leading-relaxed text-slate-700">
          En garantía y como instrumento autónomo, el Prestatario emite a la orden de{' '}
          {BRAND.legalName} el pagaré n.º <strong>{pagareNro}</strong> por el total a reintegrar
          de <strong>{money(total)}</strong> ({amountInWords(total)}), pagadero en {BRAND.city},
          con vencimiento el {lastDue ? docDate(lastDue) : 'último vencimiento del plan'},{' '}
          <strong>sin protesto</strong>. El pagaré no importa novación de este préstamo (mutuo):
          es título accesorio y el Acreedor puede exigir el contrato, el pagaré o ambos, hasta la
          cancelación íntegra. El texto completo se imprime como instrumento separado y forma
          parte de este expediente.
        </p>
      </DocumentSection>

      <DocumentSection number="09" title="Cancelación anticipada y cesión">
        <ol className="doc-clauses">
          <li>
            <strong>Prepago.</strong> El Deudor puede cancelar total o parcialmente el capital
            remanente. Los intereses se calculan hasta la fecha de acreditación del prepago. No
            hay penalidad de prepago.
          </li>
          <li>
            <strong>Cesión.</strong> El Acreedor puede ceder el crédito, el contrato y el pagaré,
            total o parcialmente, sin consentimiento del Deudor, notificando la cesión. El
            Deudor no puede ceder su posición sin autorización escrita del Acreedor.
          </li>
        </ol>
      </DocumentSection>

      <DocumentSection number="10" title="Datos personales, BCRA y ALA/FT">
        <p className="text-[13px] leading-relaxed text-slate-700">
          El Prestatario autoriza el tratamiento de sus datos (Ley 25.326), la verificación de
          identidad y las revisiones ALA/FT. {LEGAL_COPY.bcraConsulta} {LEGAL_COPY.bcraReporte} El
          titular puede ejercer acceso y rectificación ante {BRAND.privacyEmail} y ante la AAIP. La
          negativa a actualizar datos esenciales autoriza a suspender el desembolso o a caducar
          plazos. {LEGAL_COPY.uif}
        </p>
      </DocumentSection>

      <DocumentSection number="11" title="Comunicaciones, domicilio y fuero">
        <ol className="doc-clauses">
          <li>
            <strong>Comunicaciones.</strong> Valen las enviadas al correo y teléfono denunciados
            y las notificaciones en el panel UNICRÉDITOS. El cambio de domicilio o correo debe
            informarse por el panel; hasta entonces rigen los aquí consignados.
          </li>
          <li>
            <strong>Domicilio especial.</strong> Para este contrato las partes constituyen
            domicilio en los de la cláusula 2. El del Prestamista es {BRAND.address}.
          </li>
          <li>
            <strong>Fuero.</strong> {LEGAL_COPY.jurisdiction}
          </li>
          <li>
            <strong>Consumidor.</strong> Nada de este texto importa renuncia a derechos de la
            Ley 24.240. Las cláusulas abusivas, si las hubiera, se tienen por no escritas.
          </li>
        </ol>
      </DocumentSection>

      <DocumentSection number="12" title="Derecho de arrepentimiento">
        <p className="text-[13px] leading-relaxed text-slate-700">
          En contrataciones a distancia, el Prestatario puede arrepentirse dentro de los diez
          días corridos desde la aceptación (Ley 24.240 art. 34), desde el panel UNICRÉDITOS, si el
          crédito todavía no se acreditó. UNICRÉDITOS anula el contrato y el cronograma. Si el
          dinero ya se acreditó, el arrepentimiento exige devolver el capital; hasta que
          tesorería confirme la devolución, el crédito sigue vigente. También puede usarse la
          cancelación anticipada.
        </p>
      </DocumentSection>

      <DocumentSection number="13" title="Firma electrónica y aceptación">
        <p className="mb-3 text-[13px] leading-relaxed text-slate-700">
          La aceptación en la plataforma (clickwrap o firma digital) tiene los efectos de la
          Ley 25.506. El Prestatario acepta en un solo acto: (i) este contrato de préstamo
          (mutuo); (ii) el pagaré {pagareNro}; (iii) el cronograma; y (iv) las liquidaciones de
          cuota que se emitan. Quedan registrados fecha, hora, identidad, CUIL y, cuando exista,
          dirección IP y agente de usuario.
        </p>
        {contract.acceptedAt ? (
          <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950">
            <p className="font-semibold">Expediente aceptado electrónicamente</p>
            <p className="mt-1 text-xs leading-relaxed">
              Firmante: {contract.signerName ?? contract.customer?.name ?? '—'} · CUIL{' '}
              {contract.signerCuil ?? contract.customer?.cuil ?? '—'} · {docDateTime(contract.acceptedAt)}
              {contract.acceptedIp ? ` · IP ${contract.acceptedIp}` : ''} ·{' '}
              {(contract.signatureType ?? 'clickwrap').toUpperCase()}
            </p>
          </div>
        ) : (
          <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
            <p className="font-semibold">Pendiente de aceptación</p>
            <p className="mt-1 text-xs">
              Hasta la aceptación no hay desembolso ni nace el pagaré
              {contract.expirationDate ? ` · oferta válida hasta ${docDate(contract.expirationDate)}` : ''}.
            </p>
          </div>
        )}
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Deudor / librador del pagaré
            </p>
            <div className="mt-8 border-b border-slate-400" />
            <p className="mt-2 text-sm font-semibold">{contract.customer?.name ?? '—'}</p>
            <p className="font-mono text-xs text-slate-500">CUIL {contract.customer?.cuil ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Acreedor
            </p>
            <div className="mt-8 border-b border-slate-400" />
            <p className="mt-2 text-sm font-semibold">{BRAND.legalName}</p>
            <p className="text-xs text-slate-500">
              Por UNICRÉDITOS · CUIT {legalCuitLabel()} · {BRAND.city}
            </p>
          </div>
        </div>
      </DocumentSection>

      <DocumentFooter
        documentId={contract.id}
        extra={`Préstamo ${contract.loanId}. Anexos: cronograma, pagaré ${pagareNro}, liquidaciones de cuota y estado de deuda. Revisión documental ${LEGAL_REVISION}. La fecha "Vencimiento del plan" coincide con la última cuota; la oferta de aceptación (si aplica) es independiente.`}
      />
    </DocumentSheet>
  )
}
