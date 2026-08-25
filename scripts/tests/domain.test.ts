import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseAdminTab } from '../../lib/admin-nav'
import { computeFrenchAmortization, IVA_INTERESES, maxPrincipalFromInstallment } from '../../lib/finance'
import { allowedAdminTransitions, canAdminTransition, canTransition } from '../../lib/loan-state'
import { LOAN_CATALOG } from '../../lib/loan-catalog'
import { computeCreditOffer, FIRST_CREDIT_HARD_CAP } from '../../lib/loan-underwriting'
import { LEGAL_COPY } from '../../lib/legal/copy'
import { CANONICAL_HOST, shouldRedirectHost, trustedOrigins } from '../../lib/site'
import { checkEnv } from '../../lib/env'
import { barcodeSvg, couponCode, formatBarcodeHuman, formatOperationNumber } from '../../lib/coupon'
import { amountInWords } from '../../lib/legal/money-words'
import { publicBrandWebsite } from '../../lib/brand'

describe('amortización francesa', () => {
  it('cuota fija, TNA, TEA y CFT = TEA × 1,21', () => {
    const plan = computeFrenchAmortization(100_000, 12, 7.5)
    assert.equal(plan.schedule.length, 12)
    assert.equal(plan.tna, 90)
    const tea = Math.round((Math.pow(1.075, 12) - 1) * 100 * 100) / 100
    assert.equal(plan.tea, tea)
    assert.equal(plan.cft, Math.round(tea * (1 + IVA_INTERESES) * 100) / 100)
    assert.ok(Math.abs(plan.installmentAmount * 12 - plan.totalAmount) < 0.02)
    assert.ok(plan.totalAmount > 100_000)
  })

  it('tasa 0 reparte el capital', () => {
    const plan = computeFrenchAmortization(120_000, 12, 0)
    assert.equal(plan.installmentAmount, 10_000)
    assert.equal(plan.totalInterest, 0)
  })

  it('inversa: capital desde cuota tope', () => {
    const plan = computeFrenchAmortization(200_000, 12, 7.5)
    const back = maxPrincipalFromInstallment(plan.installmentAmount, 12, 7.5)
    assert.ok(back <= 200_000)
    assert.ok(back >= 199_000)
  })
})

describe('oferta por capacidad y score', () => {
  it('primer crédito no ofrece 3M aunque el score sea alto', () => {
    const offer = computeCreditOffer({
      score: 820,
      monthlyIncome: 2_000_000,
      term: 12,
      monthlyRate: 7.5,
      productMinAmount: 50_000,
      productMaxAmount: 3_000_000,
      history: { paidCount: 0, overdueCount: 0, completedLoans: 0 },
    })
    assert.equal(offer.eligible, true)
    assert.ok(offer.maxAmount <= FIRST_CREDIT_HARD_CAP)
    assert.ok(offer.maxAmount < 3_000_000)
  })

  it('sin score suficiente no hay oferta', () => {
    const offer = computeCreditOffer({
      score: 500,
      monthlyIncome: 500_000,
      term: 12,
      monthlyRate: 7.5,
      productMinAmount: 50_000,
      productMaxAmount: 3_000_000,
      history: { paidCount: 0, overdueCount: 0, completedLoans: 0 },
    })
    assert.equal(offer.eligible, false)
    assert.equal(offer.maxAmount, 0)
  })
})

describe('copy legal canónico', () => {
  it('explica mutuo y no afirma PNFC ni reporte BCRA absoluto', () => {
    assert.match(LEGAL_COPY.contractTitle, /préstamo \(mutuo/)
    assert.match(LEGAL_COPY.mutuoExplain, /1525/)
    assert.match(LEGAL_COPY.nonBank, /no es una entidad financiera/)
    assert.match(LEGAL_COPY.jurisdictionShort, /24\.240/)
    assert.match(LEGAL_COPY.bcraReporte, /únicamente cuando corresponda/)
  })
})

describe('catálogo operativo', () => {
  it('tres productos ARS con topes vigentes', () => {
    assert.equal(LOAN_CATALOG.length, 3)
    assert.equal(LOAN_CATALOG[0].maxAmount, 3_000_000)
    assert.equal(LOAN_CATALOG[1].maxAmount, 1_000_000)
    assert.equal(LOAN_CATALOG[2].maxAmount, 5_000_000)
  })
})

describe('máquina de estados', () => {
  it('permite el ciclo real y bloquea saltos', () => {
    assert.equal(canTransition('pending', 'approved'), true)
    assert.equal(canTransition('approved', 'active'), true)
    assert.equal(canTransition('active', 'paid'), true)
    assert.equal(canTransition('paid', 'active'), false)
    assert.equal(canTransition('rejected', 'approved'), false)
  })

  it('la mesa de crédito puede aprobar a mano un rechazo', () => {
    assert.equal(canAdminTransition('rejected', 'approved'), true)
    assert.equal(canAdminTransition('cancelled', 'approved'), true)
    assert.equal(canAdminTransition('pending', 'approved'), true)
    assert.equal(canAdminTransition('pending', 'active'), false)
    assert.equal(canAdminTransition('approved', 'paid'), false)
    assert.ok(allowedAdminTransitions('rejected').includes('approved'))
    assert.equal(allowedAdminTransitions('rejected').includes('active'), false)
  })
})

describe('sitio y admin', () => {
  it('canónico unicreditos.com y alias redirigen', () => {
    assert.equal(CANONICAL_HOST, 'unicreditos.com')
    assert.equal(shouldRedirectHost('unicreditos.com'), false)
    assert.equal(shouldRedirectHost('www.unicreditos.com'), false)
    assert.equal(shouldRedirectHost('unicreditos.com.ar'), true)
    assert.equal(shouldRedirectHost('unicreditos.store'), true)
    assert.equal(shouldRedirectHost('unipagos.com.ar'), true)
    assert.equal(shouldRedirectHost('www.unipagos.com.ar'), true)
    assert.equal(shouldRedirectHost('localhost'), false)
  })

  it('orígenes de auth incluyen la marca', () => {
    const origins = trustedOrigins()
    assert.ok(origins.includes('https://unicreditos.com'))
    assert.ok(origins.includes('https://www.unicreditos.com'))
    assert.ok(origins.includes('https://unicreditos.com.ar'))
  })

  it('tabs nuevas del back office existen', () => {
    assert.equal(parseAdminTab('cobranzas'), 'cobranzas')
    assert.equal(parseAdminTab('comprobantes'), 'comprobantes')
    assert.equal(parseAdminTab('movimientos'), 'movimientos')
    assert.equal(parseAdminTab('legales'), 'legales')
    assert.equal(parseAdminTab('base_clientes'), 'usuarios')
    assert.equal(parseAdminTab('cobros'), 'cobranzas')
  })
})

describe('cupón de cuota', () => {
  it('es estable para la misma cuota', () => {
    const a = couponCode({ loanId: 'loan_abc', number: 1, dueDate: '2026-09-18', amount: 432125 })
    const b = couponCode({ loanId: 'loan_abc', number: 1, dueDate: '2026-09-18', amount: 432125 })
    assert.equal(a, b)
    assert.ok(a.length > 8)
  })

  it('el código de barras se escala al ancho del talón sin recortar el número', () => {
    const raw = '3335012345678901234567890123456789012345'
    const svg = barcodeSvg(raw, { height: 48, module: 1, showText: false, fit: true })
    assert.match(svg, /width="100%"/)
    assert.match(svg, /viewBox=/)
    assert.match(svg, /preserveAspectRatio="xMidYMid meet"/)
    assert.doesNotMatch(svg, /<text /)
    assert.equal(formatBarcodeHuman(raw), '3335 0123 4567 8901 2345 6789 0123 4567 8901 2345')
    assert.equal(formatBarcodeHuman('UCABC123'), 'UCABC123')
    assert.equal(formatOperationNumber('174577133827'), '1745 7713 3827')
  })
})

describe('documentos · hallazgos auditoría', () => {
  it('monto en letras: un mil (no uno mil)', () => {
    const w = amountInWords(2_171_867.52)
    assert.match(w, /CIENTO SETENTA Y UN MIL/)
    assert.doesNotMatch(w, /UNO MIL/)
    assert.match(amountInWords(1000), /^MIL PESOS/)
  })

  it('membrete nunca usa localhost', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    // publicBrandWebsite lee BRAND.website ya resuelto al import; validamos la función con URL local simulada
    assert.equal(publicBrandWebsite().includes('localhost'), false)
    assert.match(publicBrandWebsite(), /^https:\/\/www\.unicreditos\.com$/)
    process.env.NEXT_PUBLIC_SITE_URL = prev
  })
})

describe('entorno de producción', () => {
  it('corta si el site url es localhost', () => {
    const prev = { NODE_ENV: process.env.NODE_ENV, SITE: process.env.NEXT_PUBLIC_SITE_URL }
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    const report = checkEnv()
    process.env.NODE_ENV = prev.NODE_ENV
    process.env.NEXT_PUBLIC_SITE_URL = prev.SITE
    assert.equal(
      report.missingRequired.some((item) => item.name === 'NEXT_PUBLIC_SITE_URL'),
      true,
    )
  })
})

describe('AFIP en serverless', () => {
  it('no lee certificados del disco ni tira si el path está vacío', async () => {
    const prev = process.env.VERCEL
    process.env.VERCEL = '1'
    const { getAFIPCredentials } = await import('../../lib/arca/wsaa')
    assert.doesNotThrow(() => getAFIPCredentials())
    process.env.VERCEL = prev
  })

  it('tampoco tira si VERCEL no está definido', async () => {
    const prev = process.env.VERCEL
    delete process.env.VERCEL
    const { getAFIPCredentials } = await import('../../lib/arca/wsaa')
    assert.doesNotThrow(() => getAFIPCredentials())
    if (prev === undefined) delete process.env.VERCEL
    else process.env.VERCEL = prev
  })
})
