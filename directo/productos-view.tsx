import { DIRECTO } from '@/directo/copy'
import { directoSignupHref } from '@/directo/intent'
import { formatARS } from '@/lib/finance'
import { COMERCIO_QUOTE, CONSUMO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import Link from 'next/link'

const CTA = directoSignupHref()

const PRODUCTS = [
  {
    id: 'personal',
    tag: 'Personas',
    title: 'Préstamo personal',
    quote: PERSONAL_QUOTE,
    bullets: [
      `Hasta ${formatARS(FIRST_CREDIT_HARD_CAP)} en el primer crédito`,
      `Catálogo hasta ${formatARS(PERSONAL_QUOTE.maxAmount)} con historial`,
      `${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas fijas`,
      'Acreditación en CBU o CVU a tu nombre',
      'Didit + BCRA + contrato de mutuo',
    ],
    href: CTA,
    cta: 'Solicitar en línea',
  },
  {
    id: 'comercial',
    tag: 'PyME',
    title: 'Crédito comercial',
    quote: COMERCIO_QUOTE,
    bullets: [
      `Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)}`,
      `${COMERCIO_QUOTE.minTerm} a ${COMERCIO_QUOTE.maxTerm} cuotas`,
      'Capital de trabajo. No es línea revolvente',
      'KYC y Central de Deudores',
    ],
    href: CTA,
    cta: 'Solicitar línea comercial',
  },
  {
    id: 'consumo',
    tag: 'Comercios',
    title: 'Crédito de consumo',
    quote: CONSUMO_QUOTE,
    bullets: [
      `Hasta ${formatARS(CONSUMO_QUOTE.maxAmount)}`,
      `${CONSUMO_QUOTE.minTerm} a ${CONSUMO_QUOTE.maxTerm} cuotas`,
      'El deudor es el cliente, no el comercio',
      'El cliente necesita cuenta y KYC aprobado',
    ],
    href: '/comercios',
    cta: 'Ver red de comercios',
  },
] as const

export function DirectoProductos() {
  return (
    <div className="dx-block">
      <div className="dx-wrap">
        <p className="dx-kicker">Productos</p>
        <h1>Crédito a tu medida, en línea</h1>
        <p>
          Las tasas salen del mismo catálogo que usa el simulador y el contrato. Sujeto a evaluación. El alta, la
          verificación y la firma no se reescriben: es el expediente UNICRÉDITOS de siempre. {DIRECTO.productLead}
        </p>
        <div className="dx-products">
          {PRODUCTS.map((p) => (
            <article key={p.id} id={p.id}>
              <p className="tag">{p.tag}</p>
              <h2>{p.title}</h2>
              <p>
                {p.quote.metric}. {p.quote.metricHint}
              </p>
              <ul>
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Link href={p.href} className="dx-btn">
                {p.cta}
              </Link>
            </article>
          ))}
        </div>
        <p className="dx-legal">{DIRECTO.disclaimer}</p>
      </div>
    </div>
  )
}
