import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import type { ArcaConstanciaSnapshot } from '@/lib/arca/constancia-snapshot'
import { docDateTime } from '@/lib/document-format'

function formatCuit(raw: string) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return raw || '—'
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

function personLabel(type: string) {
  if (type === 'JURIDICA') return 'Persona jurídica'
  if (type === 'FISICA') return 'Persona física'
  return 'Sin clasificar'
}

export function ArcaConstanciaPrintable({
  snapshot,
  holderName,
}: {
  snapshot: ArcaConstanciaSnapshot
  holderName?: string | null
}) {
  const number = `CONST-ARCA-${snapshot.cuil}`
  const issued = snapshot.consultedAt || new Date().toISOString()
  const domicilio = [snapshot.address, snapshot.city, snapshot.province, snapshot.postalCode].filter(Boolean).join(' · ')
  const taxes = snapshot.taxes.filter((t) => t.id || t.description)
  const activities = snapshot.activities.filter((a) => a.id || a.description)

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="constancia"
        title="Constancia de inscripción ARCA"
        subtitle="Datos consultados en el padrón de contribuyentes con certificado WSAA"
        number={number}
        issuedAt={docDateTime(issued)}
        status={snapshot.constanciaErrors.length || /inactiv|limitad/i.test(snapshot.taxStatus) ? 'Con observaciones' : 'Consulta OK'}
        statusTone={snapshot.constanciaErrors.length || /inactiv|limitad/i.test(snapshot.taxStatus) ? 'warn' : 'ok'}
      />

      <DocumentSection title="Contribuyente">
        <DocumentFieldGrid>
          <DocumentField label="CUIT" value={formatCuit(snapshot.cuil)} mono />
          <DocumentField label="Denominación" value={snapshot.name || holderName || 'Sin denominación en el padrón'} />
          <DocumentField label="Tipo de persona" value={personLabel(snapshot.personType)} />
          <DocumentField label="Estado de la clave" value={snapshot.taxStatus || 'Sin dato'} />
          <DocumentField label="Condición ARCA" value={snapshot.taxConditionLabel || snapshot.taxCondition || 'Sin dato'} />
          {snapshot.monotributoCategory ? (
            <DocumentField label="Categoría monotributo" value={snapshot.monotributoCategory} />
          ) : null}
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection title="Domicilio fiscal">
        <p className="text-sm leading-relaxed">{domicilio || 'El padrón no informó domicilio fiscal.'}</p>
      </DocumentSection>

      {taxes.length ? (
        <DocumentSection title="Impuestos informados">
          <ul className="space-y-1 text-sm">
            {taxes.map((tax) => (
              <li key={`${tax.id}-${tax.description}`}>
                {tax.id ? `${tax.id} · ` : ''}
                {tax.description || 'Impuesto'}
              </li>
            ))}
          </ul>
        </DocumentSection>
      ) : null}

      {activities.length ? (
        <DocumentSection title="Actividades">
          <ul className="space-y-1 text-sm">
            {activities.map((act) => (
              <li key={`${act.id}-${act.description}`}>
                {act.id ? `${act.id} · ` : ''}
                {act.description || 'Actividad'}
              </li>
            ))}
          </ul>
        </DocumentSection>
      ) : null}

      {snapshot.constanciaErrors.length ? (
        <DocumentSection title="Observaciones ARCA">
          <ul className="space-y-2 text-sm">
            {snapshot.constanciaErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </DocumentSection>
      ) : null}

      <DocumentFooter
        documentId={`CONST-ARCA-${snapshot.cuil}`}
        extra="Esta constancia la arma UNICRÉDITOS con la consulta oficial al padrón ARCA (WSAA). No reemplaza el PDF con código QR que emite ARCA en afip.gob.ar."
      />
    </DocumentSheet>
  )
}
