import { DirectoRequestBox } from '@/directo/request-box'
import { DIRECTO } from '@/directo/copy'
import { directoSignupHref } from '@/directo/intent'
import { BRAND } from '@/lib/brand'
import Link from 'next/link'

const CTA = directoSignupHref()

export function DirectoLanding() {
  return (
    <>
      <section className="dx-hero">
        <div className="dx-wrap">
          <p className="dx-kicker">{DIRECTO.heroKicker}</p>
          <h1>{DIRECTO.heroTitle}</h1>
          <p>{DIRECTO.heroLead}</p>
          <div className="dx-actions">
            <Link href={CTA} className="dx-btn">
              {DIRECTO.ctaPrimary}
            </Link>
            <a href="#pasos" className="dx-btn dx-btn-ghost">
              {DIRECTO.ctaSecondary}
            </a>
          </div>
          <p className="dx-note">
            {DIRECTO.fundsLine}
            <small>{DIRECTO.fundsHint}</small>
          </p>
          <div className="dx-meta">
            <div>
              CUIT <b>{BRAND.cuit}</b>
            </div>
            <div>
              IGJ <b>{BRAND.incorporated}</b>
            </div>
            <div>
              Domicilio <b>{BRAND.city}</b>
            </div>
          </div>
        </div>
      </section>

      <DirectoRequestBox />

      <section className="dx-block">
        <div className="dx-wrap">
          <h2>{DIRECTO.whyTitle}</h2>
          <p>{DIRECTO.whyLead}</p>
          <ol className="dx-ol">
            {DIRECTO.reasons.map((item) => (
              <li key={item.n}>
                <b>{item.n}</b>
                <div>
                  <h3>{item.t}</h3>
                  <p>{item.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pasos" className="dx-block">
        <div className="dx-wrap">
          <h2>{DIRECTO.stepsTitle}</h2>
          <p>{DIRECTO.stepsLead}</p>
          <ol className="dx-ol">
            {DIRECTO.steps.map((step) => (
              <li key={step.n}>
                <b>{step.n}</b>
                <div>
                  <h3>{step.t}</h3>
                  <p>{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="dx-block">
        <div className="dx-wrap">
          <h2>{DIRECTO.contrastTitle}</h2>
          <p>{DIRECTO.contrastLead}</p>
          <div className="dx-split">
            <article>
              <h3>Lo que no hacemos</h3>
              <ul>
                {DIRECTO.weDont.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Lo que sí hacemos</h3>
              <ul>
                {DIRECTO.weDo.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="dx-block">
        <div className="dx-wrap">
          <h2>{DIRECTO.productTitle}</h2>
          <p>{DIRECTO.productLead}</p>
          <p>
            {DIRECTO.productMetric}. {DIRECTO.productHint}
          </p>
          <ul className="dx-need">
            {DIRECTO.needItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="dx-legalbox">
            <p>{DIRECTO.mutuo}</p>
            <p>{DIRECTO.cft}</p>
            <p>{DIRECTO.bcra}</p>
            <p>{DIRECTO.arrepentimiento}</p>
          </div>
        </div>
      </section>

      <section className="dx-contact">
        <div className="dx-wrap">
          <h2>{DIRECTO.contactTitle}</h2>
          <p>{DIRECTO.contactLead}</p>
          <a className="mail" href={`mailto:${DIRECTO.contactEmail}`}>
            {DIRECTO.contactEmail}
          </a>
          <div className="dx-actions">
            <Link href={CTA} className="dx-btn">
              {DIRECTO.ctaPrimary}
            </Link>
            <Link href="/contacto" className="dx-btn dx-btn-ghost">
              Formulario de contacto
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
