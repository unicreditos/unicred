import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  DIRECTO,
  DIRECTO_CTA_HREF,
  DIRECTO_HOME,
  DIRECTO_NAV,
} from '../../directo/copy'
import {
  directoSignupHref,
  directoSolicitarHref,
  loggedInSignupBouncePath,
  parseDirectoIntent,
} from '../../directo/intent'
import { LEGAL_COPY } from '../../lib/legal/copy'
import { FIRST_CREDIT_HARD_CAP } from '../../lib/loan-underwriting'

describe('campaña /directo', () => {
  it('manda la solicitud al alta ya construida, no a un flujo paralelo', () => {
    assert.equal(DIRECTO_CTA_HREF, '/sign-up')
    assert.equal(DIRECTO_HOME, '/directo')
    assert.ok(DIRECTO_NAV.some((item) => item.href === '/legal/terminos'))
    assert.ok(DIRECTO_NAV.some((item) => item.href === '/legal/privacidad'))
    assert.equal(directoSignupHref(400_000, 12), '/sign-up?from=directo&monto=400000&plazo=12')
  })

  it('usa el copy legal canónico y no se vende como banco ni PNFC inscripto', () => {
    assert.equal(DIRECTO.nonBank, LEGAL_COPY.nonBank)
    assert.equal(DIRECTO.mutuo, LEGAL_COPY.mutuoExplain)
    assert.match(DIRECTO.nonBank, /no es una entidad financiera/)
    assert.match(DIRECTO.nonBank, /PNFC/)
    assert.match(DIRECTO.weDont.join(' '), /PNFC/)
    assert.doesNotMatch(DIRECTO.heroTitle, /aprobaci[oó]n (inmediata|garantizada)/i)
    assert.doesNotMatch(DIRECTO.heroLead, /en minutos te depositamos/i)
    assert.match(DIRECTO.heroLead, /UNIPAGOS/)
    assert.match(DIRECTO.heroLead, /RM International Group/)
    assert.match(DIRECTO.heroKicker, /UNIPAGOS/)
  })

  it('dice el tope del primer crédito y no vende 3 millones como si fueran el primer desembolso', () => {
    assert.equal(FIRST_CREDIT_HARD_CAP, 400_000)
    assert.match(DIRECTO.productLead, /primer crédito/)
    assert.match(DIRECTO.productLead, /400.?000/)
    assert.match(DIRECTO.productLead, /3.?000.?000/)
    assert.match(DIRECTO.productLead, /historial/)
  })

  it('se posiciona contra el hostigamiento sin nombrar a otras marcas ni copy agresivo', () => {
    const blob = [
      DIRECTO.heroTitle,
      DIRECTO.contrastTitle,
      DIRECTO.contrastLead,
      DIRECTO.reasons.map((r) => `${r.t} ${r.d}`).join(' '),
      DIRECTO.weDont.join(' '),
    ].join(' ')
    assert.match(blob, /hostig/)
    assert.doesNotMatch(blob, /micro-dinero|plata-pro|mercadopago|uala/i)
    assert.doesNotMatch(blob, /nunca acoso|te cazo|carnada|truchos|plataformas abusivas/i)
  })

  it('transporta monto y plazo al alta o al tab Solicitar', () => {
    const intent = parseDirectoIntent({ from: 'directo', monto: '250000', plazo: '18' })
    assert.equal(intent.fromDirecto, true)
    assert.equal(intent.amount, 250_000)
    assert.equal(intent.term, 18)
    assert.equal(directoSolicitarHref(intent), '/dashboard?tab=solicitar&monto=250000&plazo=18')
    assert.equal(
      loggedInSignupBouncePath('/sign-up', new URLSearchParams('from=directo&monto=250000&plazo=18')),
      '/dashboard?tab=solicitar&monto=250000&plazo=18',
    )
    assert.equal(loggedInSignupBouncePath('/sign-up', new URLSearchParams()), null)
    assert.equal(parseDirectoIntent({ monto: '99999999', plazo: '99' }).amount, 3_000_000)
    assert.equal(parseDirectoIntent({ monto: '1', plazo: '1' }).term, 3)
  })

  it('no reutiliza el kit visual del sitio institucional y unifica UNICRÉDITOS', () => {
    const chrome = readFileSync(new URL('../../directo/chrome.tsx', import.meta.url), 'utf8')
    const landing = readFileSync(new URL('../../directo/landing.tsx', import.meta.url), 'utf8')
    const box = readFileSync(new URL('../../directo/request-box.tsx', import.meta.url), 'utf8')
    const skin = readFileSync(new URL('../../directo/skin.css', import.meta.url), 'utf8')
    for (const src of [chrome, landing, box]) {
      assert.doesNotMatch(src, /dashboard-kit|BrandLogo|brand-navy|brand-primary|lucide-react/)
    }
    assert.doesNotMatch(skin, /#0B1D3A|#1E58E5|#22D3EE|#c24a1a|#C24A1A/i)
    assert.match(skin, /#20bd5a/i)
    assert.match(chrome, /BRAND\.company/)
    assert.match(chrome, /GROUP\.productLine/)
    assert.doesNotMatch(chrome, /Unicréditos/)
    assert.match(skin, /:focus-visible/)
  })
})
