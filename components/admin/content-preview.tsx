import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import { diffValues, formatDiffValue, labelForPath } from '@/lib/site-config/diff'
import type { FieldSpec, PreviewKind } from '@/lib/site-config/registry'

/** Vista previa de un borrador. Interna: no se publica ni toca créditos. */
export function ConfigPreview({ kind, value, fields }: { kind: PreviewKind; value: unknown; fields: FieldSpec[] }) {
  const v = (value ?? {}) as Record<string, unknown>
  if (kind === 'text') {
    return (
      <div className="uc-cfg-preview">
        <span className="uc-eyebrow">Así se vería en la portada</span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{String(v.text ?? '') || <span className="uc-muted">(texto vacío)</span>}</p>
      </div>
    )
  }
  if (kind === 'legal') {
    const body = String(v.body ?? '')
      .split(/\n\s*\n/)
      .filter(Boolean)
    return (
      <div className="uc-cfg-preview">
        <span className="uc-eyebrow">Así se vería en la lista de documentación</span>
        <h4>{String(v.title ?? '')}</h4>
        <p className="uc-muted" style={{ margin: 0 }}>
          {String(v.versionLabel ?? '')} · Vigente desde {formatDate(String(v.effectiveFrom ?? ''))}
        </p>
        {v.summary ? <p style={{ margin: 0 }}>{String(v.summary)}</p> : null}
        {body.length ? (
          <div style={{ borderTop: '1px solid var(--uc-border)', paddingTop: 8, display: 'grid', gap: 8 }}>
            {body.slice(0, 3).map((p, i) => (
              <p key={i} style={{ margin: 0, fontSize: 13.5 }}>
                {p}
              </p>
            ))}
            {body.length > 3 ? <span className="uc-muted">… {body.length - 3} párrafo(s) más</span> : null}
          </div>
        ) : null}
      </div>
    )
  }
  if (kind === 'pricing') {
    const products = Array.isArray(v.products) ? (v.products as Array<Record<string, unknown>>) : []
    return (
      <div className="uc-cfg-preview">
        <span className="uc-eyebrow">Cálculo de referencia (solo vista interna)</span>
        <div className="uc-table-scroll" style={{ maxHeight: 'none', minHeight: 0 }}>
          <table className="uc-dt" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>TEM</th>
                <th>TNA</th>
                <th>TEA</th>
                <th>CFT est.</th>
                <th>Cuota ref.</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const rate = Number(p.monthlyRate)
                const amount = Number(p.referenceAmount)
                const term = Number(p.referenceTerm)
                const ok = Number.isFinite(rate) && Number.isFinite(amount) && Number.isFinite(term) && term >= 1 && amount > 0
                const a = ok ? computeFrenchAmortization(amount, term, rate) : null
                return (
                  <tr key={i}>
                    <td>{String(p.name ?? p.type ?? '')}</td>
                    <td>{ok ? formatPercent(rate) : '—'}</td>
                    <td>{a ? formatPercent(a.tna) : '—'}</td>
                    <td>{a ? formatPercent(a.tea) : '—'}</td>
                    <td>{a ? formatPercent(a.cft) : '—'}</td>
                    <td>{a ? `${formatARS(a.installmentAmount)} × ${term}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <span className="uc-muted" style={{ fontSize: 12 }}>
          Usa el mismo cálculo de lib/finance. No se publica ni cambia ningún crédito.
        </span>
      </div>
    )
  }
  const rows = diffValues({}, value ?? {})
  return (
    <div className="uc-cfg-preview">
      <span className="uc-eyebrow">Valores del borrador</span>
      <dl className="uc-kv-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0, fontSize: 13.5 }}>
        {rows.map((r) => (
          <div key={r.path} style={{ display: 'contents' }}>
            <dt className="uc-muted">{labelForPath(fields, r.path)}</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatDiffValue(r.after)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function formatDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—'
}
