import { PedirFooter, PedirHeader } from '@/components/pedir/chrome'
import { BRAND } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: `Preguntas frecuentes · ${BRAND.company}`,
  description: 'Cómo pedir, verificar identidad, firmar y pagar un préstamo personal UNICRÉDITOS.',
  alternates: { canonical: '/pedir/faq' },
}

const ITEMS = [
  {
    q: '¿UNICRÉDITOS es un banco?',
    a: 'No. Es la plataforma de créditos de RM International Group S.A.S. No captamos depósitos ni estamos publicados como PNFC hasta que exista constancia BCRA.',
  },
  {
    q: '¿Por qué el contrato dice “mutuo”?',
    a: 'Porque en el Código Civil y Comercial argentino el préstamo de dinero se llama “mutuo con interés” (arts. 1525 y ss.). “Préstamo” y “mutuo” son el mismo contrato; el título del documento lo explica.',
  },
  {
    q: '¿Qué documentos necesito?',
    a: 'La identidad se valida solo con Didit (DNI vigente y prueba de vida). También necesitás CUIL, ingresos declarados y una cuenta a tu nombre (CBU, CVU o alias) para el desembolso.',
  },
  {
    q: '¿Cuánto puedo solicitar?',
    a: `La línea personal llega hasta ${formatARS(PERSONAL_QUOTE.maxAmount)}, pero el monto ofrecido sale después del scoring, la capacidad de pago (35% de ingresos) y tu historial en la app. El primer crédito en la app tiene un tope inicial más bajo.`,
  },
  {
    q: '¿Qué es el CFT?',
    a: 'El Costo Financiero Total publicado se calcula como TEA × 1,21 (IVA sobre intereses), sin seguros ni gastos de otorgamiento al deudor. No es el CFT metodológico completo de una entidad BCRA. La TNA y el CFT aparecen en la simulación y en el contrato.',
  },
  {
    q: '¿Puedo arrepentirme?',
    a: 'Sí, dentro de los 10 días corridos desde la aceptación del contrato (Ley 24.240), si el crédito todavía no se acreditó. Gestionás el arrepentimiento desde Mi cuenta / Contacto.',
  },
  {
    q: '¿Cómo contacto soporte?',
    a: `Formulario en /pedir/contacto o email ${BRAND.supportEmail}. Atención remota de lunes a viernes, 9 a 18 hs (Argentina). No hay WhatsApp ni 0800 publicado.`,
  },
]

export default function PedirFaqPage() {
  return (
    <>
      <PedirHeader solid />
      <main className="pb-16 pt-28">
        <div className="lp-container max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">Ayuda</p>
          <h1 className="lp-display mt-3 text-4xl text-[var(--lp-ink)] sm:text-5xl">Preguntas frecuentes</h1>
          <div className="lp-faq mt-10">
            {ITEMS.map((f) => (
              <details key={f.q} open>
                <summary>
                  <span>{f.q}</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--lp-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/pedir/solicitud" className="lp-btn lp-btn-ink mt-10">
            Pedí tu préstamo
          </Link>
        </div>
      </main>
      <PedirFooter />
    </>
  )
}
