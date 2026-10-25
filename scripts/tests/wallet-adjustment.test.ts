import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_ADJUST_CENTS,
  MIN_ADJUST_CENTS,
  MIN_REASON,
  REASON_SUGGESTIONS,
  amountProblem,
  isAmbiguousThousands,
  isValidAttemptId,
  parseAmountText,
  previewAdjustment,
  reasonProblem,
} from '../../lib/wallet/adjustment'

/**
 * Formulario de ajuste de saldo: la vista previa que ve la persona tiene que coincidir EXACTAMENTE con lo que después
 * interpreta el servidor, y los límites son los mismos de los dos lados.
 */
describe('importe del ajuste', () => {
  it('se interpreta igual que en el servidor (parseAmountToCents)', async () => {
    const { parseAmountToCents } = await import('../../lib/action-utils')
    const inputs = ['1250', '1.250,50', '1250.5', '$ 1.250,50', '12,5', '1.250.000', '0,01', '99999999', ' 300 ', '1.250', '0', '-5', 'abc', '', '1,2,3', '$', '12.5.5', '1e3', '0x10', '12,345', '0,001', '.5', '5.', '+5']
    for (const text of inputs) {
      let server: number | null
      try {
        server = parseAmountToCents(text)
      } catch {
        server = null
      }
      assert.equal(parseAmountText(text), server, `"${text}"`)
    }
  })

  it('el importe ambiguo "1.250" se rechaza con un mensaje que explica cómo escribirlo, y los claros pasan', () => {
    assert.equal(isAmbiguousThousands('1.250'), true)
    assert.equal(isAmbiguousThousands('$ 12.345'), true)
    for (const ok of ['1250', '1.250,00', '1250,5', '1.250.000', '12.5', '0.500x']) assert.equal(isAmbiguousThousands(ok), false, ok)
    assert.equal(parseAmountText('1.250'), null)
    assert.match(amountProblem('1.250') ?? '', /ambiguo.*1250/)
    assert.match(amountProblem('12,345') ?? '', /dos decimales/)
    assert.equal(amountProblem('1.250,00'), null)
    assert.equal(amountProblem(''), null)
  })
})

describe('vista previa del saldo resultante', () => {
  const base = { balanceCents: 8_361_900, direction: 'credit' as const }

  it('acreditar suma y debitar resta', () => {
    assert.equal(previewAdjustment({ ...base, amountText: '1250,50' }).resultingCents, 8_361_900 + 125_050)
    assert.equal(previewAdjustment({ ...base, direction: 'debit', amountText: '100' }).resultingCents, 8_361_900 - 10_000)
  })

  it('sin importe todavía no hay error ni resultado', () => {
    assert.deepEqual(previewAdjustment({ ...base, amountText: '  ' }), { cents: null, resultingCents: null, error: null, ambiguous: false })
  })

  it('un débito puede dejar la billetera exactamente en cero, pero no por debajo', () => {
    const exact = previewAdjustment({ balanceCents: 50_000, direction: 'debit', amountText: '500' })
    assert.equal(exact.error, null)
    assert.equal(exact.resultingCents, 0)
    const over = previewAdjustment({ balanceCents: 50_000, direction: 'debit', amountText: '500,01' })
    assert.match(String(over.error), /no alcanza/)
  })

  it('respeta el mínimo y el máximo por ajuste', () => {
    assert.match(String(previewAdjustment({ ...base, amountText: '0,50' }).error), /mínimo/)
    assert.equal(previewAdjustment({ ...base, amountText: '1' }).error, null)
    assert.equal(MIN_ADJUST_CENTS, 100)
    assert.equal(MAX_ADJUST_CENTS, 5_000_000_000)
    assert.equal(previewAdjustment({ balanceCents: 0, direction: 'credit', amountText: '50000000' }).error, null)
    assert.match(String(previewAdjustment({ balanceCents: 0, direction: 'credit', amountText: '50000000,01' }).error), /máximo/)
  })

  it('texto que no es un importe da un error claro', () => {
    for (const bad of ['abc', '-5', '0']) assert.match(String(previewAdjustment({ ...base, amountText: bad }).error), /importe válido/, bad)
  })
})

describe('motivo e identificador del intento', () => {
  it('el motivo exige un mínimo de caracteres y dice cuántos faltan', () => {
    assert.equal(reasonProblem('Corrección de saldo'), null)
    assert.match(String(reasonProblem('corto')), new RegExp(`faltan ${MIN_REASON - 5}`))
    assert.match(String(reasonProblem('   ')), /faltan 10/)
  })

  it('todos los motivos sugeridos son válidos por sí solos', () => {
    for (const list of Object.values(REASON_SUGGESTIONS)) {
      assert.ok(list.length >= 3)
      for (const s of list) assert.equal(reasonProblem(s), null, s)
    }
  })

  it('el identificador de intento es un UUID o similar, nunca vacío ni con símbolos', () => {
    assert.equal(isValidAttemptId(crypto.randomUUID()), true)
    for (const bad of ['', 'corto', 'con espacios 12345', "x'; drop table--", 12345678, null, 'a'.repeat(65)]) assert.equal(isValidAttemptId(bad), false, String(bad))
  })
})
