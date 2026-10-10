import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addDaysAR,
  addMonthsAR,
  addMonthsDateOnlyAR,
  arCompactDate,
  arDateKey,
  arMonthKey,
  arParts,
  dateOnlyKey,
  daysPastDueAR,
  diffDaysAR,
  endOfDayAR,
  endOfMonthAR,
  formatDateOnly,
  formatDMY,
  formatDMYHM,
  normalizeDateOnly,
  parseDateOnly,
  startOfDayAR,
  startOfMonthAR,
  toArIsoWithOffset,
  todayAR,
} from '../../lib/date-ar'

// Instantes de borde del 9 de octubre de 2026 (Argentina = UTC-03:00)
const AR_2059 = new Date('2026-10-09T20:59:00-03:00') // 23:59Z del 9
const AR_2100 = new Date('2026-10-09T21:00:00-03:00') // 00:00Z del 10  <- aqui UTC ya cambia de dia
const AR_2359 = new Date('2026-10-09T23:59:59-03:00') // 02:59:59Z del 10
const AR_0000 = new Date('2026-10-10T00:00:00-03:00')

describe('date-ar: hoy y fecha civil en Argentina', () => {
  it('20:59 AR sigue siendo 9/10 (en UTC tambien)', () => {
    assert.equal(todayAR(AR_2059), '2026-10-09')
  })

  it('21:00 AR es 9/10 aunque en UTC ya sea 10/10 (el bug original)', () => {
    assert.equal(AR_2100.toISOString().slice(0, 10), '2026-10-10') // lo que hacia el codigo viejo
    assert.equal(todayAR(AR_2100), '2026-10-09')
    assert.equal(formatDMY(AR_2100), '09/10/2026')
  })

  it('23:59:59 AR sigue siendo 9/10 y 00:00 AR ya es 10/10', () => {
    assert.equal(todayAR(AR_2359), '2026-10-09')
    assert.equal(todayAR(AR_0000), '2026-10-10')
  })

  it('arParts da la hora de pared argentina', () => {
    const p = arParts(AR_2100)
    assert.deepEqual(p, { year: 2026, month: 10, day: 9, hour: 21, minute: 0, second: 0 })
  })

  it('arMonthKey en fin/inicio de mes', () => {
    assert.equal(arMonthKey(new Date('2026-10-31T23:30:00-03:00')), '2026-10') // 02:30Z del 1/11
    assert.equal(arMonthKey(new Date('2026-11-01T00:00:00-03:00')), '2026-11')
  })

  it('arCompactDate (AAAAMMDD) usa el dia argentino', () => {
    assert.equal(arCompactDate(AR_2359), '20261009')
  })

  it('toArIsoWithOffset', () => {
    assert.equal(toArIsoWithOffset(AR_2100), '2026-10-09T21:00:00-03:00')
  })
})

describe('date-ar: inicio y fin de dia', () => {
  it('startOfDayAR / endOfDayAR de los bordes', () => {
    assert.equal(startOfDayAR(AR_2100).toISOString(), '2026-10-09T03:00:00.000Z')
    assert.equal(endOfDayAR(AR_2100).toISOString(), '2026-10-10T02:59:59.999Z')
    assert.equal(startOfDayAR(AR_2359).toISOString(), '2026-10-09T03:00:00.000Z')
    assert.equal(startOfDayAR(AR_2059).toISOString(), '2026-10-09T03:00:00.000Z')
    assert.equal(startOfDayAR(AR_0000).toISOString(), '2026-10-10T03:00:00.000Z')
  })

  it('inicio/fin de mes', () => {
    assert.equal(startOfMonthAR(AR_2100).toISOString(), '2026-10-01T03:00:00.000Z')
    assert.equal(endOfMonthAR(AR_2100).toISOString(), '2026-11-01T02:59:59.999Z')
  })
})

describe('date-ar: parseo de fechas sin hora', () => {
  it('AAAA-MM-DD es el dia local, no UTC (new Date("2026-10-09") daria 08/10 21:00 AR)', () => {
    const d = parseDateOnly('2026-10-09')!
    assert.equal(d.toISOString(), '2026-10-09T03:00:00.000Z')
    assert.equal(formatDMY(d), '09/10/2026')
    assert.equal(formatDMY(new Date('2026-10-09')), '08/10/2026') // la trampa del codigo viejo
  })

  it('DD/MM/AAAA y normalizacion', () => {
    assert.equal(normalizeDateOnly('09/10/2026'), '2026-10-09')
    assert.equal(normalizeDateOnly(' 2026-10-09 '), '2026-10-09')
  })

  it('rechaza fechas inexistentes', () => {
    assert.equal(parseDateOnly('2026-02-30'), null)
    assert.equal(parseDateOnly('31/04/2026'), null)
    assert.equal(parseDateOnly('2026-13-01'), null)
    assert.equal(parseDateOnly('hola'), null)
    assert.equal(parseDateOnly(''), null)
    assert.equal(parseDateOnly(null), null)
  })

  it('29/02 solo existe en bisiestos', () => {
    assert.notEqual(parseDateOnly('2028-02-29'), null)
    assert.equal(parseDateOnly('2026-02-29'), null)
  })

  it('formatDateOnly no usa ningun huso', () => {
    assert.equal(formatDateOnly('2026-10-09'), '09/10/2026')
    assert.equal(formatDateOnly(null), '—')
  })
})

describe('date-ar: sumar dias y meses', () => {
  it('addDaysAR conserva la hora de pared', () => {
    const r = addDaysAR(AR_2100, 1)
    assert.equal(formatDMYHM(r), '10/10/2026 21:00')
  })

  it('addMonthsAR: 21:00 AR del 9/10 + 1 mes = 9/11 (no 10/11 como en UTC)', () => {
    const r = addMonthsAR(AR_2100, 1)
    assert.equal(arDateKey(r), '2026-11-09')
  })

  it('addMonthsAR recorta a fin de mes (31/01 + 1 = 28/02; bisiesto 29/02)', () => {
    assert.equal(arDateKey(addMonthsAR(new Date('2026-01-31T12:00:00-03:00'), 1)), '2026-02-28')
    assert.equal(arDateKey(addMonthsAR(new Date('2028-01-31T12:00:00-03:00'), 1)), '2028-02-29')
    assert.equal(arDateKey(addMonthsAR(new Date('2026-03-31T12:00:00-03:00'), 1)), '2026-04-30')
    assert.equal(arDateKey(addMonthsAR(new Date('2026-08-31T12:00:00-03:00'), 6)), '2027-02-28')
  })

  it('addMonthsAR cruza de anio y soporta negativos', () => {
    assert.equal(arDateKey(addMonthsAR(new Date('2026-11-15T12:00:00-03:00'), 3)), '2027-02-15')
    assert.equal(arDateKey(addMonthsAR(new Date('2026-01-15T12:00:00-03:00'), -2)), '2025-11-15')
  })

  it('la fecha de fin de mes en horario nocturno no salta de mes (31/01 22:00 AR = 01/02 UTC)', () => {
    const r = addMonthsAR(new Date('2026-01-31T22:00:00-03:00'), 1)
    assert.equal(arDateKey(r), '2026-02-28')
  })

  it('cronograma de 6 cuotas desde el 9/10 21:30 AR: vencen el 9 de cada mes', () => {
    const from = new Date('2026-10-09T21:30:00-03:00')
    const dues = [1, 2, 3, 4, 5, 6].map((n) => arDateKey(addMonthsDateOnlyAR(from, n)))
    assert.deepEqual(dues, ['2026-11-09', '2026-12-09', '2027-01-09', '2027-02-09', '2027-03-09', '2027-04-09'])
  })

  it('cronograma desde el 31/08: no se corre a marzo', () => {
    const from = new Date('2026-08-31T21:30:00-03:00')
    const dues = [1, 2, 3, 4, 5, 6].map((n) => arDateKey(addMonthsDateOnlyAR(from, n)))
    assert.deepEqual(dues, ['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'])
  })
})

describe('date-ar: dias de atraso', () => {
  const due = parseDateOnly('2026-10-09')! // vence el 9/10 (00:00 AR)

  it('el dia del vencimiento hay 0 dias de atraso, a las 20:59, 21:00 y 23:59', () => {
    assert.equal(daysPastDueAR(due, AR_2059), 0)
    assert.equal(daysPastDueAR(due, AR_2100), 0) // en UTC darian 1
    assert.equal(daysPastDueAR(due, AR_2359), 0)
  })

  it('a las 00:00 AR del dia siguiente pasa a 1', () => {
    assert.equal(daysPastDueAR(due, AR_0000), 1)
  })

  it('vencimiento guardado con hora (21:30 AR) cuenta el mismo dia civil', () => {
    const dueWithTime = new Date('2026-10-09T21:30:00-03:00') // 00:30Z del 10
    assert.equal(daysPastDueAR(dueWithTime, AR_2359), 0)
    assert.equal(daysPastDueAR(dueWithTime, AR_0000), 1)
  })

  it('diffDaysAR en fin de mes y negativos', () => {
    assert.equal(diffDaysAR('2026-10-31', '2026-11-01'), 1)
    assert.equal(diffDaysAR('2026-11-01', '2026-10-31'), -1)
    assert.equal(diffDaysAR('2026-02-28', '2026-03-01'), 1)
  })

  it('30 dias de gracia: se cumplen recien al dia 30 civil', () => {
    const d = parseDateOnly('2026-09-09')!
    assert.equal(daysPastDueAR(d, new Date('2026-10-08T23:59:59-03:00')), 29)
    assert.equal(daysPastDueAR(d, new Date('2026-10-09T00:00:00-03:00')), 30)
  })
})

describe('date-ar: formato', () => {
  it('dd/mm/aaaa y dd/mm/aaaa HH:mm', () => {
    assert.equal(formatDMY(AR_2359), '09/10/2026')
    assert.equal(formatDMYHM(AR_2359), '09/10/2026 23:59')
    assert.equal(formatDMYHM(AR_0000), '10/10/2026 00:00')
  })

  it('valores vacios o invalidos', () => {
    assert.equal(formatDMY(null), '—')
    assert.equal(formatDMY(undefined), '—')
    assert.equal(formatDMY('no es fecha'), '—')
    assert.equal(formatDMY(new Date('x'), 'n/d'), 'n/d')
  })
})
describe('date-ar: dateOnlyKey (compatibilidad con fechas viejas guardadas a 00:00 UTC)', () => {
  it('lee 00:00Z como su fecha UTC y 00:00 AR como su fecha AR', () => {
    assert.equal(dateOnlyKey(new Date('2026-10-09T00:00:00.000Z')), '2026-10-09') // dato viejo
    assert.equal(dateOnlyKey(parseDateOnly('2026-10-09')!), '2026-10-09') // dato nuevo (03:00Z)
    assert.equal(dateOnlyKey(new Date('2026-10-09T21:30:00-03:00')), '2026-10-09') // instante con hora
  })
})
