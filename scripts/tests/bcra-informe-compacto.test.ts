import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bcraSituationMatrix, compactARS } from '@/components/documents/bcra-extract-document'
import { BCRAReportPrintable } from '@/components/documents/bcra-report-printable'
import type { BcraPeriodoResumen, FullBcraSnapshot } from '@/lib/bcra'

// Datos ficticios: 30 períodos x 8 entidades.
function periods(n: number, entities: number): BcraPeriodoResumen[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7 - i, 1))
    const periodo = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const ents = Array.from({ length: entities }, (_, k) => ({ entidad: `BANCO EJEMPLO ${k + 1}`, situacion: k === 0 && i === 3 ? 3 : 1, monto: 100000 }))
    return { periodo, entidades: ents, worstSituation: Math.max(...ents.map((e) => e.situacion)), totalDebt: 100000 * entities }
  })
}

test('grilla de situación: hasta 24 períodos, más nuevo primero, una fila por entidad', () => {
  const { cols, rows } = bcraSituationMatrix(periods(30, 8))
  assert.equal(cols.length, 24)
  assert.equal(cols[0].periodo, '202608')
  assert.equal(rows.length, 8)
  assert.equal(rows[0].entidad, 'BANCO EJEMPLO 1')
  assert.equal(rows[0].cells.get('202605'), 3)
})

test('montos compactos para celdas angostas', () => {
  assert.equal(compactARS(850), '$ 850')
  assert.equal(compactARS(848000), '$ 848 k')
  assert.equal(compactARS(1_250_000), '$ 1,3 M')
})

test('informe impreso: sin una fila por entidad y mes', () => {
  const hist = periods(24, 8)
  const snapshot = {
    deudas: { denominacion: 'TITULAR EJEMPLO', periodo: '202608', entidades: hist[0].entidades },
    historicas: { denominacion: 'TITULAR EJEMPLO', periodos: hist },
    chequesRechazados: { denominacion: 'TITULAR EJEMPLO', cheques: [] },
  } as unknown as FullBcraSnapshot
  const html = renderToStaticMarkup(
    createElement(BCRAReportPrintable, {
      report: { id: 'x', reportNumber: 'CONS-1', scoreAtGeneration: 620, worstSituation: 1, totalDebt: 800000, entitiesCount: 8, hasRejectedChecks: false, createdAt: new Date('2026-10-10') },
      extract: snapshot,
    }),
  )
  assert.equal((html.match(/<tr/g) ?? []).length < 40, true)
  assert.ok(html.includes('bcra-matrix'))
  assert.ok(!html.includes('Créditos por período histórico'))
})
