import { Badge } from '@/components/uc/blocks'
import { STATUS_LABEL, type VersionStatus } from '@/lib/site-config/core'
import { diffValues, formatDiffValue, labelForPath } from '@/lib/site-config/diff'
import type { FieldSpec, Sensitivity } from '@/lib/site-config/registry'

/* Piezas de presentación compartidas entre páginas de servidor y el editor (sin estado, sin acceso a datos). */

export const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  normal: 'Texto',
  pricing: 'Sensible · doble control',
  legal: 'Legal · doble control',
}

export function StatusBadge({ status }: { status: VersionStatus }) {
  const tone = status === 'published' ? 'success' : status === 'approved' ? 'info' : status === 'in_review' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>
}

export function SensitivityBadge({ sensitivity }: { sensitivity: Sensitivity }) {
  return <Badge tone={sensitivity === 'normal' ? 'neutral' : 'warning'}>{SENSITIVITY_LABEL[sensitivity]}</Badge>
}

/** Vista de cambios campo por campo entre dos valores. */
export function DiffTable({ before, after, fields, beforeLabel, afterLabel }: { before: unknown; after: unknown; fields: FieldSpec[]; beforeLabel: string; afterLabel: string }) {
  const rows = diffValues(before, after)
  if (!rows.length) {
    return (
      <p className="uc-muted" role="status" style={{ margin: 0 }}>
        Sin diferencias entre {beforeLabel.toLowerCase()} y {afterLabel.toLowerCase()}.
      </p>
    )
  }
  return (
    <div className="uc-table-scroll" style={{ maxHeight: 'none', minHeight: 0 }}>
      <table className="uc-dt uc-cfg-diff">
        <thead>
          <tr>
            <th>Campo</th>
            <th>{beforeLabel}</th>
            <th>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.path}>
              <td>{labelForPath(fields, r.path)}</td>
              <td>{r.kind === 'added' ? <span className="uc-muted">—</span> : <span className="uc-old">{formatDiffValue(r.before)}</span>}</td>
              <td>{r.kind === 'removed' ? <span className="uc-muted">(se quita)</span> : <span className="uc-new">{formatDiffValue(r.after)}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
