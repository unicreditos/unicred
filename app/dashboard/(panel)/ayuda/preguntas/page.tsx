import { PageHead, Pad } from '@/components/uc/blocks'

export const metadata = { title: 'Preguntas frecuentes' }

const FAQS: Array<[string, string]> = [
  ['¿Cuándo recibo el dinero?', 'Después de firmar el contrato, el desembolso se hace en el día hábil a la cuenta que confirmaste.'],
  ['¿Quién decide mi solicitud?', 'Con tus datos, tu situación en el BCRA y tu capacidad de pago, el sistema puede calificar o rechazar al instante los casos claros. Los demás pasan a revisión manual, y ahí decide una persona del equipo.'],
  ['¿Puedo adelantar cuotas o cancelar antes?', 'Sí. En el detalle de tu crédito ves el monto de cancelación anticipada, sin cargos ocultos.'],
  ['¿Cómo pido el certificado de libre deuda?', 'Se genera solo al pagar la última cuota y queda en Documentos, en el filtro «Libre deuda».'],
  ['Pagué y la cuota no figura', 'Los pagos con Mercado Pago se acreditan en minutos. Las transferencias pueden tardar hasta 48 h hábiles en conciliarse.'],
  ['¿Por qué no puedo pedir un crédito?', 'Hace falta tener el perfil completo, la identidad validada con Didit y no tener otro crédito vigente.'],
  ['¿A qué cuenta se transfiere el dinero?', 'Solo a una cuenta a tu nombre (CBU, CVU o alias). No se gira a terceros.'],
]

export default function PreguntasPage() {
  return (
    <>
      <PageHead title="Preguntas frecuentes" description="Respuestas a lo que más nos consultan." />
      <Pad className="uc-faq">
        {FAQS.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </Pad>
    </>
  )
}
