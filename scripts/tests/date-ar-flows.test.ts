import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { couponCode } from '../../lib/coupon'
import { addYearsToDateKey, arDateKey, parseDateOnly } from '../../lib/date-ar'
import { adultBirthDateBounds, isPlausibleAdultBirthDate } from '../../lib/didit-expected'
import { buildInstallmentValues } from '../../lib/loan-schedule'
import { addMonths, daysPastDue, evaluateIntimation, intimableInstallments } from '../../lib/legal/mora'
import { withdrawalDeadline } from '../../lib/legal/withdrawal'

const NIGHT = new Date('2026-10-09T21:30:00-03:00') // 10/10 00:30Z: el instante en que Arias Nicolas ingreso el credito

describe('flujos de credito con hora argentina (el servidor corre en UTC)', () => {
  it('cronograma de 6 cuotas generado a las 21:30 AR del 9/10 vence el 9 de cada mes (no el 10)', () => {
    const { rows } = buildInstallmentValues({
      loanId: 'loan_arias',
      userId: 'user_arias',
      principal: 400_000,
      term: 6,
      monthlyRate: 0.05,
      from: NIGHT,
    })
    assert.equal(rows.length, 6)
    assert.deepEqual(
      rows.map((r) => arDateKey(r.dueDate)),
      ['2026-11-09', '2026-12-09', '2027-01-09', '2027-02-09', '2027-03-09', '2027-04-09'],
    )
    // vencimiento = fecha civil a las 00:00 AR
    assert.equal(rows[0]!.dueDate.toISOString(), '2026-11-09T03:00:00.000Z')
    assert.equal(arDateKey(rows[0]!.createdAt), '2026-10-09')
  })

  it('cronograma desde un 31: no se corre a marzo (recorte a fin de mes)', () => {
    const { rows } = buildInstallmentValues({
      loanId: 'l',
      userId: 'u',
      principal: 100_000,
      term: 6,
      monthlyRate: 0.05,
      from: new Date('2026-08-31T22:00:00-03:00'),
    })
    assert.deepEqual(
      rows.map((r) => arDateKey(r.dueDate)),
      ['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'],
    )
  })

  it('mora: el dia del vencimiento no hay atraso a las 20:59, 21:00 ni 23:59 AR', () => {
    const due = parseDateOnly('2026-10-09')!
    for (const hhmm of ['20:59:00', '21:00:00', '23:59:59']) {
      assert.equal(daysPastDue(due, new Date('2026-10-09T' + hhmm + '-03:00')), 0, hhmm)
    }
    assert.equal(daysPastDue(due, new Date('2026-10-10T00:00:00-03:00')), 1)
    // string de fecha sin hora
    assert.equal(daysPastDue('2026-10-09', new Date('2026-10-09T23:59:59-03:00')), 0)
  })

  it('intimacion: 30 dias de gracia contados en dias argentinos', () => {
    const rows = [{ number: 1, amount: 1000, dueDate: parseDateOnly('2026-09-09')!, status: 'pending' }]
    assert.equal(intimableInstallments(rows, null, new Date('2026-10-08T23:59:59-03:00')).length, 0)
    assert.equal(intimableInstallments(rows, null, new Date('2026-10-09T00:00:00-03:00')).length, 1)
    assert.equal(evaluateIntimation(rows, null, new Date('2026-10-08T22:00:00-03:00')).reason, 'gracia')
  })

  it('addMonths de mora (refinanciacion) recorta a fin de mes y deja 00:00 AR', () => {
    const r = addMonths(new Date('2026-01-31T23:00:00-03:00'), 1)
    assert.equal(arDateKey(r), '2026-02-28')
    assert.equal(r.toISOString(), '2026-02-28T03:00:00.000Z')
  })

  it('codigo de cupon: el vencimiento es el dia argentino', () => {
    const code = couponCode({ loanId: 'loan_abcdefghij', number: 1, dueDate: new Date('2026-11-09T22:00:00-03:00'), amount: 1000 })
    assert.ok(code.includes('20261109'), code) // en UTC saldria 20261110
    const code2 = couponCode({ loanId: 'loan_abcdefghij', number: 1, dueDate: parseDateOnly('2026-11-09')!, amount: 1000 })
    assert.ok(code2.includes('20261109'), code2)
  })

  it('arrepentimiento: 10 dias corridos desde la aceptacion, misma hora de pared', () => {
    const d = withdrawalDeadline(new Date('2026-10-09T22:00:00-03:00'))
    assert.equal(arDateKey(d), '2026-10-19')
  })

  it('mayoria de edad usa el dia de hoy en Argentina', () => {
    // 09/10/2026 21:30 AR: nacio el 09/10/2008 -> cumple 18 hoy (en UTC "hoy" seria 10/10 y daria igual, pero el limite no debe correrse)
    const b = adultBirthDateBounds(NIGHT)
    assert.equal(b.max, '2008-10-09')
    assert.equal(b.min, '1926-10-09')
    assert.equal(isPlausibleAdultBirthDate('2008-10-09', NIGHT), true)
    assert.equal(isPlausibleAdultBirthDate('2008-10-10', NIGHT), false)
  })

  it('29/02: la mayoria de edad de quien nacio un 29/02 se corre al 28/02', () => {
    assert.equal(addYearsToDateKey('2028-02-29', -18), '2010-02-28')
    assert.equal(addYearsToDateKey('2028-02-29', 1), '2029-02-28')
  })
})