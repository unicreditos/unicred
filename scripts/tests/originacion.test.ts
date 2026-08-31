import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeFrenchAmortization,
  IVA_INTERESES,
  PUNITORY_RATE,
  maxPrincipalFromInstallment,
} from '../../lib/finance'
import { frenchInstallmentSplit } from '../../lib/legal/money-words'
import { resolvedTea } from '../../lib/loan-rates'
import { opnfcBand, OPNFC_THRESHOLD_ARS } from '../../lib/compliance/opnfc'
import {
  documentPdfBaseName,
  sanitizePdfFileName,
  shortDocCode,
} from '../../lib/document-filename'
import {
  LEGAL_COPY,
  LEGAL_PRIVACY_VERSION,
  LEGAL_REVISION,
  LEGAL_TCG_VERSION,
} from '../../lib/legal/copy'
import {
  canTransition,
  generatesDebt,
  LOAN_STATUS_LABELS,
} from '../../lib/loan-state'
import {
  computeCreditOffer,
  contractNeedsSignature,
  decideUnderwriting,
  FIRST_CREDIT_HARD_CAP,
  INCOME_DTI_RATIO,
  SCORE_AUTO_QUALIFY_AT,
  SCORE_REJECT_BELOW,
} from '../../lib/loan-underwriting'
import type { ScoreResult } from '../../lib/bcra'

function score(n: number, band = 'bueno'): ScoreResult {
  return {
    score: n,
    band: band as ScoreResult['band'],
    reasons: [],
    factors: {},
  } as ScoreResult
}

describe('CFT y amortización', () => {
  it('CFT = TEA × 1,21 sin sumar seguros al plan', () => {
    const plan = computeFrenchAmortization(500_000, 12, 7.5)
    const expectedCft = Math.round(plan.tea * (1 + IVA_INTERESES) * 100) / 100
    assert.equal(plan.cft, expectedCft)
    assert.equal(plan.schedule.length, 12)
    assert.ok(plan.installmentAmount * 12 - plan.totalAmount < 0.02)
  })

  it('inversa de cuota respeta el capital', () => {
    const plan = computeFrenchAmortization(300_000, 18, 7.5)
    const back = maxPrincipalFromInstallment(plan.installmentAmount, 18, 7.5)
    assert.ok(back <= 300_000)
    assert.ok(back >= 299_000)
  })
})

describe('underwriting y oferta', () => {
  it('rechaza score bajo', () => {
    const d = decideUnderwriting({
      score: score(SCORE_REJECT_BELOW - 1),
      installmentAmount: 10_000,
      monthlyIncome: 500_000,
      worstSituation: 1,
      rejectedChecksCount: 0,
    })
    assert.equal(d.outcome, 'rejected')
  })

  it('revisión manual en banda media', () => {
    const d = decideUnderwriting({
      score: score(SCORE_AUTO_QUALIFY_AT - 1),
      installmentAmount: 10_000,
      monthlyIncome: 500_000,
      worstSituation: 1,
      rejectedChecksCount: 0,
    })
    assert.equal(d.outcome, 'pending_review')
  })

  it('califica con score alto y cuota dentro del 35%', () => {
    const income = 800_000
    const maxCuota = income * INCOME_DTI_RATIO
    const d = decideUnderwriting({
      score: score(720),
      installmentAmount: maxCuota * 0.5,
      monthlyIncome: income,
      worstSituation: 1,
      rejectedChecksCount: 0,
    })
    assert.equal(d.outcome, 'qualified')
  })

  it('rechaza si la cuota supera el 35% de ingresos', () => {
    const d = decideUnderwriting({
      score: score(800),
      installmentAmount: 400_000,
      monthlyIncome: 500_000,
      worstSituation: 1,
      rejectedChecksCount: 0,
    })
    assert.equal(d.outcome, 'rejected')
  })

  it('primer crédito no ofrece 3M', () => {
    const offer = computeCreditOffer({
      score: 850,
      monthlyIncome: 3_000_000,
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

  it('consumo comercio también respeta techo de primer crédito', () => {
    const offer = computeCreditOffer({
      score: 900,
      monthlyIncome: 5_000_000,
      term: 18,
      monthlyRate: 7.5,
      productMinAmount: 50_000,
      productMaxAmount: 1_000_000,
      history: { paidCount: 0, overdueCount: 0, completedLoans: 0 },
    })
    assert.ok(offer.maxAmount <= FIRST_CREDIT_HARD_CAP)
  })

  it('historial con mora reduce el techo', () => {
    const clean = computeCreditOffer({
      score: 750,
      monthlyIncome: 1_000_000,
      term: 12,
      monthlyRate: 7.5,
      productMinAmount: 50_000,
      productMaxAmount: 3_000_000,
      history: { paidCount: 6, overdueCount: 0, completedLoans: 1 },
    })
    const dirty = computeCreditOffer({
      score: 750,
      monthlyIncome: 1_000_000,
      term: 12,
      monthlyRate: 7.5,
      productMinAmount: 50_000,
      productMaxAmount: 3_000_000,
      history: { paidCount: 6, overdueCount: 2, completedLoans: 1 },
    })
    assert.ok(dirty.maxAmount <= clean.maxAmount)
  })

  it('firma pendiente solo en estados de contrato correctos', () => {
    assert.equal(contractNeedsSignature('pending_acceptance'), true)
    assert.equal(contractNeedsSignature('generated'), true)
    assert.equal(contractNeedsSignature('accepted'), false)
    assert.equal(contractNeedsSignature(null), false)
  })
})

describe('máquina de estados del crédito', () => {
  it('ciclo originación → firma → vigente → cancelado', () => {
    assert.equal(canTransition('pending', 'approved'), true)
    assert.equal(canTransition('approved', 'active'), true)
    assert.equal(canTransition('active', 'paid'), true)
    assert.equal(canTransition('pending', 'active'), false)
    assert.equal(canTransition('approved', 'paid'), false)
    assert.equal(generatesDebt('approved'), false)
    assert.equal(generatesDebt('active'), true)
    assert.equal(LOAN_STATUS_LABELS.approved, 'Calificado')
  })
})

describe('nombres PDF por documento', () => {
  it('cada tipo genera un nombre distinto y estable', () => {
    const id = 'abc12345-def0-4111-8222-333344445555'
    const names = [
      documentPdfBaseName('Contrato', shortDocCode(id, 'CTR')),
      documentPdfBaseName('Pagare', shortDocCode(id, 'PAG')),
      documentPdfBaseName('Estado-deuda', shortDocCode(id, 'ED')),
      documentPdfBaseName('Cuponera', shortDocCode(id, 'CUP')),
      documentPdfBaseName('Liquidacion', 'LIQ-9988'),
      documentPdfBaseName('Intimacion', 'INT-001'),
    ]
    const unique = new Set(names)
    assert.equal(unique.size, names.length)
    for (const n of names) {
      assert.match(n, /^UNICREDITOS-/)
      assert.equal(n, sanitizePdfFileName(n))
      assert.ok(!n.includes(' '))
    }
  })

  it('sanitiza caracteres inválidos', () => {
    assert.equal(sanitizePdfFileName('Contrato / Mutuo (v2)'), 'Contrato-Mutuo-v2')
  })
})

describe('copy legal canónico E2E textual', () => {
  it('versión y claims regulatorios alineados', () => {
    assert.equal(LEGAL_REVISION, '30/08/2026')
    assert.equal(LEGAL_TCG_VERSION, 'TCG-v9.2')
    assert.equal(LEGAL_PRIVACY_VERSION, 'Privacy-v4.1')
    assert.match(LEGAL_COPY.contractTitle, /préstamo \(mutuo/)
    assert.match(LEGAL_COPY.mutuoExplain, /1525/)
    assert.match(LEGAL_COPY.nonBank, /PNFC/)
    assert.match(LEGAL_COPY.cftContractNote, /TEA × 1,21/)
    assert.match(LEGAL_COPY.punitorios, /0%/)
    assert.match(LEGAL_COPY.walletLedger, /No es un CVU/)
    assert.match(LEGAL_COPY.bcraReporte, /únicamente cuando corresponda/)
    assert.match(LEGAL_COPY.jurisdiction, /24\.240/)
    assert.doesNotMatch(LEGAL_COPY.cftContractNote, /25\.065/)
    assert.doesNotMatch(LEGAL_COPY.bcraReporteShort, /se reportará automáticamente/)
  })
})

describe('TEA, punitorios y OPNFC', () => {
  it('resuelve TEA persistida o la recalcula de la TEM', () => {
    assert.equal(resolvedTea({ tea: 138.18, monthlyRate: 7.5 }), 138.18)
    const fromTem = resolvedTea({ tea: null, monthlyRate: 7.5 })
    assert.equal(fromTem, computeFrenchAmortization(100_000, 12, 7.5).tea)
  })

  it('punitorios contractuales son 0%', () => {
    assert.equal(PUNITORY_RATE, 0)
  })

  it('IVA de intereses de una cuota es 21% del interés francés', () => {
    const split = frenchInstallmentSplit(500_000, 7.5, 12, 1)
    const iva = Math.round(split.interest * IVA_INTERESES * 100) / 100
    assert.ok(split.interest > 0)
    assert.equal(iva, Math.round(split.interest * 0.21 * 100) / 100)
  })

  it('umbral PNFC de 10 millones', () => {
    assert.equal(opnfcBand(0), 'below')
    assert.equal(opnfcBand(8_000_000), 'approaching')
    assert.equal(opnfcBand(OPNFC_THRESHOLD_ARS), 'threshold_crossed')
  })
})
