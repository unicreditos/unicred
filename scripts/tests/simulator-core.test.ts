import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeFrenchAmortization } from '../../lib/finance'
import { LOAN_CATALOG, PERSONAL_QUOTE } from '../../lib/loan-catalog'
import {
  clampAmount,
  parseAmountInput,
  SIM_AMOUNT_STEP,
  simulate,
  termOptionsFor,
} from '../../lib/simulator-core'

const personal = LOAN_CATALOG[0]

describe('simulador publico: plazos segun configuracion de producto', () => {
  it('personal ofrece 3..48 e incluye 9 (antes la home no lo ofrecia)', () => {
    assert.deepEqual(termOptionsFor(personal), [3, 6, 9, 12, 18, 24, 36, 48])
  })
  it('consumo/comercio (1..24) incluyen 1 y 24 y nada por encima', () => {
    for (const p of [LOAN_CATALOG[1], LOAN_CATALOG[2]]) {
      const t = termOptionsFor(p)
      assert.equal(t[0], 1)
      assert.equal(t.at(-1), 24)
      assert.ok(t.every((x) => x >= p.minTerm && x <= p.maxTerm))
    }
  })
  it('todos los plazos ofrecidos son validos para el producto', () => {
    for (const p of LOAN_CATALOG) for (const t of termOptionsFor(p)) assert.ok(t >= p.minTerm && t <= p.maxTerm)
  })
})

describe('simulador publico: validacion de monto', () => {
  it('acepta formatos argentinos', () => {
    for (const s of ['500000', '500.000', '$ 500.000', '500.000,00', ' 500000 ']) {
      const r = parseAmountInput(s, personal)
      assert.equal(r.ok, true, s)
      if (r.ok) assert.equal(r.value, 500_000)
    }
  })
  it('rechaza vacio, letras, fuera de rango y enormes, con mensaje', () => {
    for (const s of ['', '   ', 'abc', '12abc', '49999', '3000001', '-100000', '9'.repeat(30)]) {
      const r = parseAmountInput(s, personal)
      assert.equal(r.ok, false, `"${s}" no deberia ser valido`)
      if (!r.ok) assert.ok(r.error.length > 5)
    }
  })
  it('limites exactos son validos', () => {
    assert.equal(parseAmountInput(String(personal.minAmount), personal).ok, true)
    assert.equal(parseAmountInput(String(personal.maxAmount), personal).ok, true)
  })
  it('clampAmount respeta rango y paso', () => {
    assert.equal(clampAmount(-5, personal), personal.minAmount)
    assert.equal(clampAmount(99_999_999, personal), personal.maxAmount)
    assert.equal(clampAmount(Number.NaN, personal), personal.minAmount)
    const v = clampAmount(123_456, personal)
    assert.equal((v - personal.minAmount) % SIM_AMOUNT_STEP, 0)
  })
})

describe('simulador publico: coincide con el calculo real (lib/finance.ts)', () => {
  it('cuota, totales y tasas son los de computeFrenchAmortization para todo monto/plazo', () => {
    for (const p of LOAN_CATALOG)
      for (const t of termOptionsFor(p))
        for (const a of [p.minAmount, p.referenceAmount, p.maxAmount]) {
          const real = computeFrenchAmortization(a, t, p.monthlyRate)
          const sim = simulate(p, a, t)
          assert.equal(sim.installmentAmount, real.installmentAmount)
          assert.equal(sim.totalAmount, real.totalAmount)
          assert.equal(sim.tna, real.tna)
          assert.equal(sim.tea, real.tea)
          assert.equal(sim.cft, real.cft)
        }
  })
  it('la tabla tiene una fila por cuota, cuota = la del credito, saldo final 0 y capital suma el monto (±1 peso de redondeo)', () => {
    for (const p of LOAN_CATALOG)
      for (const t of termOptionsFor(p)) {
        const a = p.referenceAmount
        const sim = simulate(p, a, t)
        assert.equal(sim.rows.length, t)
        assert.ok(sim.rows.every((r) => r.installment === sim.installmentAmount))
        assert.equal(sim.rows.at(-1)!.balance, 0)
        const cap = sim.rows.reduce((s, r) => s + r.capital, 0)
        assert.ok(Math.abs(cap - a) <= 1, `capital ${cap} vs ${a} (${p.type}/${t})`)
      }
  })
  it('la referencia publicada (catalogo) coincide con el simulador sin cambiar la metodologia: CFT = TEA x 1,21', () => {
    const sim = simulate(personal, personal.referenceAmount, personal.referenceTerm)
    assert.equal(sim.cft, PERSONAL_QUOTE.cft)
    assert.equal(sim.cft, Math.round(sim.tea * 1.21 * 100) / 100)
  })
})