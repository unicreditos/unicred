import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateSummaryMetrics,
  getApplicationDisbursementDate,
  isDateInRange,
  parseDateInput,
  resolveDateRange,
  toInputDate,
} from '../../lib/admin-desk/date-filter'
import { arParts } from '../../lib/date-ar'
import type { Credit, Disbursement, LoanApplication } from '../../lib/admin-desk/types'

// Las fechas se comparan en hora de Argentina, sin depender del huso de la maquina (UTC en Vercel/CI, AR en la PC).
const arY = (d: Date) => arParts(d).year
const arM = (d: Date) => arParts(d).month - 1 // 0-indexado, como Date#getMonth
const arD = (d: Date) => arParts(d).day
const arH = (d: Date) => arParts(d).hour
const arMin = (d: Date) => arParts(d).minute

function makeApp(
  id: string,
  amount: number,
  status: 'pending' | 'approved' | 'rejected' | 'cancelled',
  createdAt: string,
  decidedAt?: string | null,
): LoanApplication {
  return {
    id,
    clientId: 'cli_test',
    productId: 'prod_test',
    merchantId: null,
    amount,
    installments: 12,
    status,
    purpose: 'Test',
    createdAt,
    decidedAt: decidedAt ?? null,
    operatorId: null,
    notes: '',
  }
}

function makeCredit(
  id: string,
  applicationId: string,
  amount: number,
  status: 'approved' | 'active' | 'paid' | 'cancelled',
  disbursedAt?: string | null,
): Credit {
  return {
    id,
    applicationId,
    clientId: 'cli_test',
    productId: 'prod_test',
    merchantId: null,
    amount,
    principalOutstanding: amount,
    installments: 12,
    installmentAmount: 1000,
    tna: 70,
    tea: 98,
    cft: 118,
    status,
    disbursedAt: disbursedAt ?? null,
    firstDueDate: '2026-11-01',
    schedule: [],
    daysPastDue: 0,
    bucket: 'al_dia',
  }
}

function makeDisbursement(
  id: string,
  creditId: string,
  amount: number,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  requestedAt: string,
  completedAt?: string | null,
): Disbursement {
  return {
    id,
    creditId,
    clientId: 'cli_test',
    amount,
    status,
    cbu: '0170099220000012345678',
    bank: 'BBVA',
    requestedAt,
    completedAt: completedAt ?? null,
    operatorId: null,
    reference: 'REF-123',
  }
}

describe('Filtro de fechas y métricas de originación / desembolso', () => {
  it('parsea fechas ISO y DMY correctamente', () => {
    const d1 = parseDateInput('2026-05-15', false)
    assert.ok(d1)
    assert.equal(arY(d1), 2026)
    assert.equal(arM(d1), 4) // Mayo (0-indexed)
    assert.equal(arD(d1), 15)

    const d2 = parseDateInput('15/05/2026', true)
    assert.ok(d2)
    assert.equal(arY(d2), 2026)
    assert.equal(arM(d2), 4)
    assert.equal(arD(d2), 15)
    assert.equal(arH(d2), 23)
    assert.equal(arMin(d2), 59)

    assert.equal(parseDateInput(''), null)
    assert.equal(parseDateInput('invalida'), null)
  })

  it('toInputDate formatea consistentemente YYYY-MM-DD', () => {
    const d = new Date('2026-10-08T12:00:00-03:00') // 8 de Octubre 2026
    assert.equal(toInputDate(d), '2026-10-08')
    assert.equal(toInputDate(null), '')
  })

  it('resuelve el rango de mes actual por defecto', () => {
    const ref = new Date('2026-10-08T12:00:00-03:00') // Octubre 2026
    const range = resolveDateRange('current_month', undefined, undefined, ref)
    assert.equal(range.preset, 'current_month')
    assert.ok(range.from)
    assert.ok(range.to)
    assert.equal(arY(range.from), 2026)
    assert.equal(arM(range.from), 9)
    assert.equal(arD(range.from), 1)
    assert.equal(arM(range.to), 9)
    assert.equal(arD(range.to), 31)
  })

  it('resuelve rangos para periodos más allá del mes actual (últimos 30 días, mes anterior, trimestre, año, todo)', () => {
    const ref = new Date('2026-10-08T12:00:00-03:00') // 8 de Octubre 2026

    // Mes anterior (Septiembre 2026)
    const lastMonth = resolveDateRange('last_month', undefined, undefined, ref)
    assert.equal(lastMonth.preset, 'last_month')
    assert.equal(arM(lastMonth.from!), 8) // Septiembre
    assert.equal(arM(lastMonth.to!), 8)
    assert.equal(arD(lastMonth.to!), 30)

    // Últimos 30 días
    const l30 = resolveDateRange('last_30_days', undefined, undefined, ref)
    assert.equal(l30.preset, 'last_30_days')
    assert.ok(l30.from)
    assert.ok(l30.to)

    // Trimestre
    const q = resolveDateRange('quarter', undefined, undefined, ref)
    assert.equal(q.preset, 'quarter')

    // Año
    const yr = resolveDateRange('year', undefined, undefined, ref)
    assert.equal(yr.preset, 'year')
    assert.equal(arY(yr.from!), 2026)
    assert.equal(arM(yr.from!), 0)

    // Histórico completo (all)
    const all = resolveDateRange('all', undefined, undefined, ref)
    assert.equal(all.preset, 'all')
    assert.equal(all.from, null)
    assert.equal(all.to, null)

    // Personalizado
    const custom = resolveDateRange('custom', '2026-03-01', '2026-06-30', ref)
    assert.equal(custom.preset, 'custom')
    assert.equal(arM(custom.from!), 2)
    assert.equal(arM(custom.to!), 5)
  })

  it('evalúa isDateInRange correctamente dentro y fuera de límites', () => {
    const from = new Date('2026-06-01T00:00:00-03:00')
    const to = new Date('2026-06-30T23:59:59.999-03:00')

    assert.equal(isDateInRange('2026-06-15T12:00:00Z', from, to), true)
    // 31/05 20:59 AR (23:59Z): sigue en mayo para Argentina -> fuera de junio
    assert.equal(isDateInRange('2026-05-31T23:59:59Z', from, to), false)
    // 01/06 00:00 AR (03:00Z): primer instante de junio -> adentro
    assert.equal(isDateInRange('2026-06-01T03:00:00Z', from, to), true)
    assert.equal(isDateInRange('2026-06-01T02:59:59Z', from, to), false)
    // 30/06 21:00 AR (01/07 00:00Z): en UTC ya es julio, en Argentina sigue siendo junio -> adentro
    assert.equal(isDateInRange('2026-07-01T00:00:00Z', from, to), true)
    // 01/07 00:00 AR (03:00Z): julio -> afuera
    assert.equal(isDateInRange('2026-07-01T03:00:00Z', from, to), false)
    assert.equal(isDateInRange(null, from, to), false)
    // Sin límites (all)
    assert.equal(isDateInRange('2026-01-01', null, null), true)
  })

  it('obtiene la fecha efectiva de desembolso según desembolso, crédito o solicitud aprobada', () => {
    const app = makeApp('app_1', 150_000, 'approved', '2026-05-10', '2026-05-12')
    const cred = makeCredit('cred_1', 'app_1', 150_000, 'active', '2026-05-14T10:00:00Z')
    const disb = makeDisbursement('disb_1', 'app_1', 150_000, 'completed', '2026-05-13', '2026-05-15T16:00:00Z')

    // Con desembolso completado, prioriza la fecha de liquidación del desembolso
    const dDate1 = getApplicationDisbursementDate(app, [cred], [disb])
    assert.ok(dDate1)
    assert.equal(arD(dDate1), 15)

    // Sin desembolso, usa la del crédito
    const dDate2 = getApplicationDisbursementDate(app, [cred], [])
    assert.ok(dDate2)
    assert.equal(arD(dDate2), 14)

    // Sin crédito ni desembolso, pero solicitud aprobada con decidedAt
    const dDate3 = getApplicationDisbursementDate(app, [], [])
    assert.ok(dDate3)
    assert.equal(arD(dDate3), 12)

    // Solicitud rechazada o pendiente no devuelve fecha de desembolso
    const appPend = makeApp('app_2', 100_000, 'pending', '2026-05-10')
    assert.equal(getApplicationDisbursementDate(appPend, [], []), null)
  })

  it('filtra solicitudes procesadas y monto desembolsado por periodos personalizados más allá del mes actual', () => {
    // Escenario de prueba con solicitudes en distintos meses:
    // Mayo 2026: 2 procesadas (1 aprobada $200.000, 1 rechazada)
    // Junio 2026: 1 procesada (aprobada $350.000)
    // Octubre 2026: 1 procesada (aprobada $100.000)
    // Pendiente: 1 solicitud ($50.000)
    const apps: LoanApplication[] = [
      makeApp('app_may_1', 200_000, 'approved', '2026-05-02', '2026-05-04'),
      makeApp('app_may_2', 120_000, 'rejected', '2026-05-10', '2026-05-11'),
      makeApp('app_jun_1', 350_000, 'approved', '2026-06-15', '2026-06-16'),
      makeApp('app_oct_1', 100_000, 'approved', '2026-10-02', '2026-10-03'),
      makeApp('app_pend', 50_000, 'pending', '2026-10-07'),
    ]

    const credits: Credit[] = [
      makeCredit('cred_may_1', 'app_may_1', 200_000, 'active', '2026-05-05T12:00:00Z'),
      makeCredit('cred_jun_1', 'app_jun_1', 350_000, 'active', '2026-06-17T12:00:00Z'),
      makeCredit('cred_oct_1', 'app_oct_1', 100_000, 'active', '2026-10-04T12:00:00Z'),
    ]

    const disbursements: Disbursement[] = [
      makeDisbursement('disb_may_1', 'app_may_1', 200_000, 'completed', '2026-05-04', '2026-05-05T15:00:00Z'),
      makeDisbursement('disb_jun_1', 'app_jun_1', 350_000, 'completed', '2026-06-16', '2026-06-17T15:00:00Z'),
      makeDisbursement('disb_oct_1', 'app_oct_1', 100_000, 'completed', '2026-10-03', '2026-10-04T15:00:00Z'),
    ]

    // 1. Filtrar por rango personalizado: Mayo 2026 completo (2026-05-01 al 2026-05-31)
    const rangeMay = resolveDateRange('custom', '2026-05-01', '2026-05-31')
    const metricsMay = calculateSummaryMetrics(apps, credits, disbursements, rangeMay)

    assert.equal(metricsMay.totalProcessed, 2, 'En mayo hubo 2 solicitudes procesadas')
    assert.equal(metricsMay.approvedCount, 1)
    assert.equal(metricsMay.rejectedCount, 1)
    assert.equal(metricsMay.totalDisbursed, 200_000, 'En mayo se desembolsaron $200.000')
    assert.equal(metricsMay.disbursedCount, 1)

    // 2. Filtrar por rango personalizado: Bimestre Mayo + Junio (2026-05-01 al 2026-06-30)
    const rangeBimester = resolveDateRange('custom', '2026-05-01', '2026-06-30')
    const metricsBimester = calculateSummaryMetrics(apps, credits, disbursements, rangeBimester)

    assert.equal(metricsBimester.totalProcessed, 3, 'En el bimestre hubo 3 solicitudes procesadas')
    assert.equal(metricsBimester.totalDisbursed, 550_000, 'Desembolsado en el bimestre: 200k + 350k = 550k')
    assert.equal(metricsBimester.disbursedCount, 2)

    // 3. Filtrar por mes en curso (Octubre 2026)
    const refOct = new Date('2026-10-08T12:00:00-03:00')
    const rangeOct = resolveDateRange('current_month', undefined, undefined, refOct)
    const metricsOct = calculateSummaryMetrics(apps, credits, disbursements, rangeOct)

    assert.equal(metricsOct.totalProcessed, 1)
    assert.equal(metricsOct.totalDisbursed, 100_000)
    assert.equal(metricsOct.disbursedCount, 1)

    // 4. Histórico completo (preset 'all')
    const rangeAll = resolveDateRange('all')
    const metricsAll = calculateSummaryMetrics(apps, credits, disbursements, rangeAll)

    assert.equal(metricsAll.totalProcessed, 4, 'Total de solicitudes procesadas sin contar la pendiente')
    assert.equal(metricsAll.totalDisbursed, 650_000, 'Total histórico desembolsado: 200k + 350k + 100k')
    assert.equal(metricsAll.disbursedCount, 3)
    assert.equal(metricsAll.allProcessedCount, 4)
  })

  it('fechas sin hora (AAAA-MM-DD) se interpretan como dia argentino, no UTC', () => {
    const app = makeApp('app_x', 150_000, 'approved', '2026-05-10', '2026-05-12')
    const d = getApplicationDisbursementDate(app, [], [])!
    assert.equal(toInputDate(d), '2026-05-12')
    assert.equal(arH(d), 0)
  })

  it('el "hoy" del dashboard es el dia argentino aunque en UTC ya sea manana (bordes 20:59 / 21:00 / 23:59)', () => {
    for (const hhmm of ['20:59:00', '21:00:00', '23:59:59']) {
      const ref = new Date('2026-10-09T' + hhmm + '-03:00')
      const l30 = resolveDateRange('last_30_days', undefined, undefined, ref)
      assert.equal(l30.toStr, '2026-10-09', 'hasta hoy a las ' + hhmm)
      assert.equal(l30.fromStr, '2026-09-09')
      const cur = resolveDateRange('current_month', undefined, undefined, ref)
      assert.equal(cur.fromStr, '2026-10-01')
      assert.equal(cur.toStr, '2026-10-31')
    }
    const next = resolveDateRange('last_30_days', undefined, undefined, new Date('2026-10-10T00:00:00-03:00'))
    assert.equal(next.toStr, '2026-10-10')
  })

  it('fin de mes a las 21:00-23:59 AR no salta de mes', () => {
    const ref = new Date('2026-10-31T23:30:00-03:00') // 01/11 02:30Z
    const cur = resolveDateRange('current_month', undefined, undefined, ref)
    assert.equal(cur.label.startsWith('Octubre 2026'), true)
    assert.equal(cur.toStr, '2026-10-31')
    const prev = resolveDateRange('last_month', undefined, undefined, ref)
    assert.equal(prev.fromStr, '2026-09-01')
    assert.equal(prev.toStr, '2026-09-30')
  })

  it('un credito ingresado a las 21:30 AR del 9/10 cae en el 9/10 (no en el 10/10)', () => {
    const entered = '2026-10-10T00:30:00.000Z' // 09/10 21:30 AR
    const app = makeApp('app_arias', 400_000, 'pending', entered)
    const range = resolveDateRange('custom', '2026-10-09', '2026-10-09')
    assert.equal(isDateInRange(app.createdAt, range.from, range.to), true)
    const tomorrow = resolveDateRange('custom', '2026-10-10', '2026-10-10')
    assert.equal(isDateInRange(app.createdAt, tomorrow.from, tomorrow.to), false)
  })

  it('maneja rangos sin operaciones devolviendo ceros sin fallar', () => {
    const apps: LoanApplication[] = [
      makeApp('app_1', 100_000, 'approved', '2026-05-01', '2026-05-02'),
    ]
    const rangeEmpty = resolveDateRange('custom', '2024-01-01', '2024-01-31')
    const metricsEmpty = calculateSummaryMetrics(apps, [], [], rangeEmpty)

    assert.equal(metricsEmpty.totalProcessed, 0)
    assert.equal(metricsEmpty.totalDisbursed, 0)
    assert.equal(metricsEmpty.disbursedCount, 0)
    assert.equal(metricsEmpty.avgDisbursed, 0)
    assert.equal(metricsEmpty.approvalRate, 0)
    assert.equal(metricsEmpty.allProcessedCount, 1)
  })
})
