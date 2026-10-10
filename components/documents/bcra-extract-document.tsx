import { SITUACION_BCRA } from '@/lib/bcra-labels'
import type { BcraDeudaEntidad, BcraPeriodoResumen, FullBcraSnapshot } from '@/lib/bcra'
import { formatARS, formatDateArg } from '@/lib/finance'

/**
 * Extracto de la Central de Deudores para imprimir, con el formato de los informes comerciales
 * (Nosis, Veraz): deudas vigentes, una grilla entidad × mes con la situación de los últimos
 * 24 períodos y los totales por período. Entra en una o dos hojas aunque haya muchas entidades.
 */

const MAX_PERIODS = 24

function sitShort(n?: number | null) {
  if (!n) return '—'
  return `${n} · ${SITUACION_BCRA[n] ?? 'Informada'}`
}

function shortPeriod(periodo: string) {
  const p = String(periodo ?? '').replace(/\D/g, '')
  return p.length === 6 ? `${p.slice(4, 6)}/${p.slice(2, 4)}` : periodo
}

/** $ 1,2 M · $ 350 k · $ 900: los totales por período tienen que entrar en celdas angostas. */
export function compactARS(value: number) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  const fmt = (v: number, digits: number) => v.toLocaleString('es-AR', { maximumFractionDigits: digits })
  if (abs >= 1_000_000_000) return `$ ${fmt(n / 1_000_000_000, 1)} MM`
  if (abs >= 1_000_000) return `$ ${fmt(n / 1_000_000, 1)} M`
  if (abs >= 1_000) return `$ ${fmt(n / 1_000, 0)} k`
  return `$ ${fmt(n, 0)}`
}

function flags(e: BcraDeudaEntidad) {
  const bits: string[] = []
  if (e.refinanciaciones) bits.push('Refinanciado')
  if (e.recategorizacionOblig) bits.push('Recategorizado')
  if (e.situacionJuridica) bits.push('Sit. jurídica')
  if (e.irrecDisposicionTecnica) bits.push('Irrec. disp. técnica')
  if (e.enRevision) bits.push('En revisión')
  if (e.procesoJud) bits.push('En juicio')
  return bits.join(' · ')
}

/** Pura: filas = entidades, columnas = períodos (más nuevo a la izquierda), celda = peor situación del mes. */
export function bcraSituationMatrix(periods: BcraPeriodoResumen[], max = MAX_PERIODS) {
  const cols = [...periods].sort((a, b) => b.periodo.localeCompare(a.periodo)).slice(0, max)
  const byEntity = new Map<string, Map<string, number>>()
  for (const p of cols) {
    for (const e of p.entidades) {
      const name = e.entidad || 'Entidad sin nombre'
      const row = byEntity.get(name) ?? new Map<string, number>()
      row.set(p.periodo, Math.max(row.get(p.periodo) ?? 0, Number(e.situacion) || 0))
      byEntity.set(name, row)
    }
  }
  const rows = [...byEntity.entries()]
    .map(([entidad, cells]) => ({ entidad, cells, worst: Math.max(0, ...cells.values()) }))
    .sort((a, b) => b.worst - a.worst || a.entidad.localeCompare(b.entidad))
  return { cols, rows }
}

export function BcraExtractDocument({ snapshot }: { snapshot: FullBcraSnapshot }) {
  const vigentes = [...(snapshot.deudas.entidades ?? [])].sort((a, b) => b.situacion - a.situacion || b.monto - a.monto)
  const { cols, rows } = bcraSituationMatrix(snapshot.historicas.periodos ?? [])
  const cheques = snapshot.chequesRechazados.cheques ?? []
  const half = Math.ceil(cols.length / 2)
  const debtStrips = cols.length > 12 ? [cols.slice(0, half), cols.slice(half)] : [cols]

  return (
    <div className="bcra-doc">
      <h3 className="bcra-doc-h">
        Deudas vigentes
        {snapshot.deudas.periodo ? <span> · período {shortPeriod(snapshot.deudas.periodo)}</span> : null}
      </h3>
      {vigentes.length ? (
        <table className="doc-table bcra-doc-table">
          <colgroup>
            <col style={{ width: '38%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Situación</th>
              <th className="num">Monto</th>
              <th className="num">Atraso</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {vigentes.map((e, i) => (
              <tr key={`${e.entidad}-${i}`}>
                <td>{e.entidad}</td>
                <td className={`bcra-sit-text s${Math.min(e.situacion || 0, 6)}`}>{sitShort(e.situacion)}</td>
                <td className="num">{formatARS(e.monto)}</td>
                <td className="num">{e.diasAtrasoPago ?? 0} d</td>
                <td className="bcra-doc-note">
                  {[e.fechaSit1 ? `Sit. 1 desde ${formatDateArg(e.fechaSit1)}` : '', flags(e)].filter(Boolean).join(' · ') || '—'}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={2}>Total ({vigentes.length} entidad{vigentes.length === 1 ? '' : 'es'})</td>
              <td className="num">{formatARS(vigentes.reduce((acc, e) => acc + (Number(e.monto) || 0), 0))}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="bcra-doc-empty">Sin deudas informadas en el último período.</p>
      )}

      <h3 className="bcra-doc-h">
        {`Evolución de la situación · últimos ${cols.length} ${cols.length === 1 ? 'período' : 'períodos'}`}
      </h3>
      {cols.length && rows.length ? (
        <>
          <table className="bcra-matrix">
            <thead>
              <tr>
                <th className="ent">Entidad</th>
                {cols.map((p) => {
                  const [mm, yy] = shortPeriod(p.periodo).split('/')
                  return (
                    <th key={p.periodo}>
                      {mm}
                      {yy ? <small>{yy}</small> : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entidad}>
                  <td className="ent">{r.entidad}</td>
                  {cols.map((p) => {
                    const s = r.cells.get(p.periodo)
                    return (
                      <td key={p.periodo} className={s ? `s${Math.min(s, 6)}` : 'empty'}>
                        {s || ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="worst">
                <td className="ent">Peor situación del mes</td>
                {cols.map((p) => (
                  <td key={p.periodo} className={p.worstSituation ? `s${Math.min(p.worstSituation, 6)}` : 'empty'}>
                    {p.worstSituation || ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="bcra-legend">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n}>
                <i className={`s${n}`}>{n}</i> {SITUACION_BCRA[n]}
              </span>
            ))}
            <span>Vacío: sin deuda informada ese mes.</span>
          </p>

          <h3 className="bcra-doc-h">Deuda total por período</h3>
          {debtStrips.map((strip, i) => (
            <table className="bcra-debt" key={i}>
              <tbody>
                <tr>
                  {strip.map((p) => (
                    <th key={p.periodo}>{shortPeriod(p.periodo)}</th>
                  ))}
                </tr>
                <tr>
                  {strip.map((p) => (
                    <td key={p.periodo}>{compactARS(p.totalDebt)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          ))}
        </>
      ) : (
        <p className="bcra-doc-empty">Sin informes históricos.</p>
      )}

      <h3 className="bcra-doc-h">Cheques rechazados ({cheques.length})</h3>
      {cheques.length ? (
        <table className="doc-table bcra-doc-table">
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Cheque</th>
              <th>Entidad</th>
              <th>Causal</th>
              <th>Rechazo</th>
              <th>Pago</th>
              <th className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map((c, i) => (
              <tr key={`${c.nroCheque}-${i}`}>
                <td>{c.nroCheque ?? '—'}</td>
                <td>
                  {c.denomJuridica || c.entidad || '—'}
                  {c.procesoJud ? ' · En juicio' : c.enRevision ? ' · En revisión' : ''}
                </td>
                <td>{c.causal ?? '—'}</td>
                <td>{c.fechaRechazo ? formatDateArg(c.fechaRechazo) : '—'}</td>
                <td>{c.fechaPago ? formatDateArg(c.fechaPago) : '—'}</td>
                <td className="num">{c.monto != null ? formatARS(c.monto) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="bcra-doc-empty">Sin cheques rechazados informados.</p>
      )}
    </div>
  )
}
