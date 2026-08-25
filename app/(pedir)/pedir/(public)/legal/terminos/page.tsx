import { PedirFooter, PedirHeader } from '@/components/pedir/chrome'
import { BRAND, legalPartyLine } from '@/lib/brand'
import {
  LEGAL_COPY,
  LEGAL_REVISION,
  LEGAL_TCG_VERSION,
} from '@/lib/legal/copy'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: `Términos y condiciones · ${BRAND.company}`,
  description: 'Términos y Condiciones Generales del canal de préstamos personales UNICRÉDITOS.',
  alternates: { canonical: '/pedir/legal/terminos' },
}

const SECCIONES = [
  {
    id: '1',
    t: '1 · Aceptación y partes',
    p: [
      `Los presentes Términos y Condiciones Generales (TCG) regulan la relación entre UNICRÉDITOS, unidad de negocios de ${legalPartyLine()}, y el Usuario que solicita un préstamo personal en este canal.`,
      'Al crear cuenta, marcar aceptación o enviar una solicitud, el Usuario declara capacidad legal para contratar y aceptar estos TCG de forma voluntaria.',
    ],
  },
  {
    id: '2',
    t: '2 · Servicio de este canal',
    p: [
      'Este canal ofrece préstamo personal online (mutuo con interés según CCCN arts. 1525 y ss.), verificación de identidad (Didit), consulta a la Central de Deudores del BCRA con tu autorización, scoring UNICRÉDITOS, contrato y pagaré, desembolso a CBU/CVU/alias propio y cobro de cuotas (Mercado Pago o transferencia a la cuenta de tesorería informada).',
      LEGAL_COPY.nonBank,
      LEGAL_COPY.mutuoExplain,
    ],
  },
  {
    id: '3',
    t: '3 · Requisitos y KYC',
    p: [
      'Mayoría de edad, DNI argentino, CUIL propio, ingresos declarados, cuenta a tu nombre y verificación Didit aprobada.',
      LEGAL_COPY.bcraConsulta,
    ],
  },
  {
    id: '4',
    t: '4 · Tasas y CFT',
    p: [LEGAL_COPY.cftShort, LEGAL_COPY.cftLong],
  },
  {
    id: '5',
    t: '5 · Cuotas y pagos',
    p: [
      'Sistema francés (cuotas iguales) salvo indicación en el contrato. El vencimiento se traslada al próximo día hábil bancario si cae en feriado.',
      'Pagás por Mercado Pago, tarjeta o transferencia a la cuenta de RM International Group S.A.S. informada en tu cuenta. El débito automático de CBU no está habilitado.',
    ],
  },
  {
    id: '6',
    t: '6 · Mora y cobranza',
    p: [
      'La mora se registra en el cronograma. Punitorios, si aplican, se informan en el contrato. Intimaciones las emite administración sobre atraso relevante (30 días o más).',
      LEGAL_COPY.bcraReporte,
    ],
  },
  {
    id: '7',
    t: '7 · Cancelación anticipada',
    p: ['Podés cancelar el saldo en cualquier momento sin multa, liquidando intereses no devengados.'],
  },
  {
    id: '8',
    t: '8 · Datos personales',
    p: [
      `El tratamiento se rige por la Política de Privacidad de este canal, Ley 25.326 y RG AAIP 78/2019. Contacto de privacidad: ${BRAND.privacyEmail}.`,
    ],
  },
  {
    id: '9',
    t: '9 · ALA/FT',
    p: [
      `Te obligás a no usar el servicio para lavado de activos, financiación del terrorismo u otras actividades ilícitas. ${LEGAL_COPY.uif}`,
    ],
  },
  {
    id: '10',
    t: '10 · Reclamos',
    p: [
      `Canal: formulario en /pedir/contacto y email ${BRAND.supportEmail}. Plazo máximo de respuesta a reclamos: 10 días hábiles (Ley 24.240). ${LEGAL_COPY.noWhatsapp0800}`,
    ],
  },
  {
    id: '11',
    t: '11 · Arrepentimiento',
    p: [LEGAL_COPY.arrepentimiento],
  },
  {
    id: '12',
    t: '12 · Jurisdicción',
    p: [LEGAL_COPY.jurisdictionShort],
  },
  {
    id: '13',
    t: '13 · Vigencia',
    p: [`Versión ${LEGAL_TCG_VERSION} · canal préstamos online · revisión ${LEGAL_REVISION}.`],
  },
]

export default function PedirTerminosPage() {
  return (
    <>
      <PedirHeader solid />
      <main className="pb-20 pt-28">
        <div className="lp-container max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">Legal</p>
          <h1 className="lp-display mt-2 text-4xl text-[var(--lp-ink)] sm:text-5xl">Términos y condiciones</h1>
          <p className="mt-3 text-sm text-[var(--lp-muted)]">
            Canal de préstamos personales. También podés leer la{' '}
            <Link href="/pedir/legal/privacidad" className="font-semibold text-[var(--lp-mint-deep)] underline">
              política de privacidad
            </Link>
            .
          </p>
          <div className="mt-10 space-y-6">
            {SECCIONES.map((s) => (
              <section key={s.id} id={`sec-${s.id}`} className="lp-tile">
                <h2 className="text-lg font-semibold text-[var(--lp-ink)]">{s.t}</h2>
                <div className="mt-3 space-y-2">
                  {s.p.map((par) => (
                    <p key={par.slice(0, 48)} className="text-sm leading-relaxed text-[var(--lp-muted)]">
                      {par}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <PedirFooter />
    </>
  )
}
