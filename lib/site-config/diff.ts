import type { FieldSpec } from './registry'

/** Diferencias entre dos valores. Sin dependencias de servidor: se usa también en el navegador. */

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export type DiffRow = { path: string; before: unknown; after: unknown; kind: 'changed' | 'added' | 'removed' }

function flatten(value: unknown, prefix: string, out: Map<string, unknown>) {
  if (Array.isArray(value)) {
    if (!value.length) out.set(prefix, [])
    value.forEach((v, i) => flatten(v, `${prefix}[${i + 1}]`, out))
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) out.set(prefix, {})
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else {
    out.set(prefix, value)
  }
}

/** Diferencias campo por campo entre dos valores (para la vista de cambios). */
export function diffValues(before: unknown, after: unknown): DiffRow[] {
  const a = new Map<string, unknown>()
  const b = new Map<string, unknown>()
  flatten(before, '', a)
  flatten(after, '', b)
  const paths = [...new Set([...a.keys(), ...b.keys()])]
  const rows: DiffRow[] = []
  for (const path of paths) {
    const hasA = a.has(path)
    const hasB = b.has(path)
    if (hasA && hasB) {
      if (stableStringify(a.get(path)) !== stableStringify(b.get(path))) rows.push({ path, before: a.get(path), after: b.get(path), kind: 'changed' })
    } else if (hasB) rows.push({ path, before: undefined, after: b.get(path), kind: 'added' })
    else rows.push({ path, before: a.get(path), after: undefined, kind: 'removed' })
  }
  return rows
}

export function formatDiffValue(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return 'vacío'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'string') return v === '' ? '(vacío)' : v
  return stableStringify(v)
}

/** Nombre legible de una ruta ("products[2].monthlyRate" → "Productos 2 · Tasa mensual (TEM)"). */
export function labelForPath(fields: FieldSpec[], path: string): string {
  const parts: string[] = []
  let level: FieldSpec[] | undefined = fields
  for (const seg of path.split('.')) {
    const m = /^([^[\]]+)(?:\[(\d+)\])?$/.exec(seg)
    if (!m) {
      parts.push(seg)
      continue
    }
    const f: FieldSpec | undefined = level?.find((x) => x.name === m[1])
    parts.push((f?.label ?? m[1]) + (m[2] ? ` ${m[2]}` : ''))
    level = f?.rows
  }
  return parts.join(' · ')
}
