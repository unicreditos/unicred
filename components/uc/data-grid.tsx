'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/uc/icons'
import { DeskActionButton } from '@/components/uc/desk-action'
import type { Cell, Col, GridConfig, GridRow, RowAction, Tone } from '@/components/uc/grid-types'
import { fdate, fdatetime, fmtInt, fmtPct, money, norm, parseDMY } from '@/lib/uc/format'

const isObj = (c: Cell): c is Exclude<Cell, string | number | null | undefined | RowAction[]> =>
  typeof c === 'object' && c !== null && !Array.isArray(c)

function sortValue(col: Col, row: GridRow): number | string {
  const c = row[col.key] as Cell
  if (c == null) return -Infinity
  if (Array.isArray(c)) return 0
  if (isObj(c)) {
    if ('l' in c) {
      const i = col.order?.indexOf(c.l) ?? -1
      return i >= 0 ? i : c.l
    }
    if ('a' in c) return c.a
    return c.text
  }
  if (col.kind === 'date' || col.kind === 'datetime') {
    const t = new Date(String(c)).getTime()
    return Number.isNaN(t) ? -Infinity : t
  }
  return c
}

function plain(c: Cell): string {
  if (c == null || Array.isArray(c)) return ''
  if (isObj(c)) return 'l' in c ? c.l : 'a' in c ? `${c.a} ${c.b ?? ''}` : c.text
  return String(c)
}

function RenderCell({ col, row }: { col: Col; row: GridRow }) {
  const c = row[col.key] as Cell
  const dash = <span className="uc-muted">—</span>
  switch (col.kind ?? 'text') {
    case 'money':
      return c == null || c === '' ? dash : <>{money(c as number)}</>
    case 'pct':
      return c == null ? dash : <>{fmtPct(c as number)}</>
    case 'date':
      return c ? <>{fdate(c as string)}</> : dash
    case 'datetime':
      return c ? <>{fdatetime(c as string)}</> : dash
    case 'badge': {
      if (!isObj(c) || !('l' in c)) return c ? <>{String(c)}</> : dash
      return <span className={`uc-badge uc-${c.t}`}>{c.l}</span>
    }
    case 'stack': {
      if (!isObj(c) || !('a' in c)) return <>{plain(c)}</>
      return (
        <>
          {c.a}
          {c.b ? <span className="uc-sub uc-num">{c.b}</span> : null}
        </>
      )
    }
    case 'link': {
      if (!isObj(c) || !('href' in c)) return <>{plain(c)}</>
      return <Link href={c.href}>{c.text}</Link>
    }
    case 'actions': {
      const list = Array.isArray(c) ? c : []
      if (!list.length) return null
      return (
        <div className="uc-row-actions">
          {list.map((a, i) =>
            a.kind === 'link' ? (
              <Link key={i} href={a.href} className="uc-row-action">
                {a.icon ? <Icon name={a.icon} size="xs" /> : null}
                {a.label}
              </Link>
            ) : (
              <DeskActionButton key={i} spec={a} />
            ),
          )}
        </div>
      )
    }
    default:
      return c == null || c === '' ? dash : <>{String(c)}</>
  }
}

type State = { chip: string; q: string; from: string; to: string; sel: Record<string, string>; sort: string | null; dir: 1 | -1; page: number }

export function DataGrid({ cfg }: { cfg: GridConfig }) {
  const hasToolbar = cfg.toolbar !== false
  const [st, setSt] = useState<State>({
    chip: 'all',
    q: '',
    from: '',
    to: '',
    sel: {},
    sort: cfg.sort?.key ?? null,
    dir: cfg.sort?.dir ?? 1,
    page: 1,
  })
  const scroller = useRef<HTMLDivElement>(null)
  const patch = (p: Partial<State>) => setSt((s) => ({ ...s, ...p }))

  const selectOptions = useMemo(
    () =>
      Object.fromEntries(
        (cfg.selects ?? []).map((s) => [
          s.key,
          s.options ?? [...new Set(cfg.rows.map((r) => plain(r[s.key] as Cell)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
        ]),
      ),
    [cfg.rows, cfg.selects],
  )

  const searchable = useMemo(
    () => (cfg.searchKeys ? cfg.rows.map((r) => norm(cfg.searchKeys!.map((k) => plain(r[k] as Cell)).join(' '))) : []),
    [cfg.rows, cfg.searchKeys],
  )

  const base = useMemo(() => {
    const from = parseDMY(st.from)
    const to = parseDMY(st.to)
    const q = norm(st.q.trim())
    return cfg.rows.filter((r, i) => {
      if (q && cfg.searchKeys && !searchable[i].includes(q)) return false
      if (cfg.dateKey) {
        const t = r[cfg.dateKey] ? new Date(String(r[cfg.dateKey])).getTime() : null
        if (from && (t == null || t < from.getTime())) return false
        if (to && (t == null || t >= to.getTime() + 86_400_000)) return false
      }
      for (const s of cfg.selects ?? []) {
        if (st.sel[s.key] && plain(r[s.key] as Cell) !== st.sel[s.key]) return false
      }
      return true
    })
  }, [cfg, st.q, st.from, st.to, st.sel, searchable])

  const chipMatch = (r: GridRow, v: string) => {
    if (!cfg.chips) return true
    const opt = cfg.chips.options.find((o) => o.v === v)
    const val = plain(r[cfg.chips.key] as Cell)
    return opt?.in ? opt.in.includes(val) : val === v
  }

  const rows = useMemo(() => {
    let out = cfg.chips && st.chip !== 'all' ? base.filter((r) => chipMatch(r, st.chip)) : base
    if (st.sort) {
      const col = cfg.columns.find((c) => c.key === st.sort)
      if (col) {
        out = out.slice().sort((a, b) => {
          const x = sortValue(col, a)
          const y = sortValue(col, b)
          const r = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y)
          return (Number.isNaN(r) ? 0 : r) * st.dir
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, st.chip, st.sort, st.dir, cfg.columns])

  const total = rows.length
  const pageSize = cfg.pageSize
  const pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1
  const page = Math.min(Math.max(1, st.page), pages)
  const start = pageSize ? (page - 1) * pageSize : 0
  const pageRows = pageSize ? rows.slice(start, start + pageSize) : rows

  const nums: Array<number | '…'> = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  const active = st.chip !== 'all' || st.q || st.from || st.to || Object.values(st.sel).some(Boolean)
  const sumValue = cfg.summary?.sumKey
    ? rows.reduce((s, r) => s + (Number(r[cfg.summary!.sumKey!] as number) || 0), 0)
    : null

  function sortBy(key: string) {
    setSt((s) => (s.sort === key ? { ...s, dir: s.dir === 1 ? -1 : 1 } : { ...s, sort: key, dir: 1 }))
  }

  const maskDate = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8)
    return d.slice(0, 2) + (d.length > 2 ? '/' + d.slice(2, 4) : '') + (d.length > 4 ? '/' + d.slice(4) : '')
  }

  return (
    <div className={`uc-card ${cfg.sheet ? 'uc-sheet' : ''}`}>
      {hasToolbar ? (
        <>
          <div className="uc-toolbar">
            <div className="uc-tb-left">
              {cfg.chips ? (
                <div className="uc-chips" role="group" aria-label={cfg.chips.label}>
                  {cfg.chips.options.map((o) => {
                    const count = o.v === 'all' ? base.length : base.filter((r) => chipMatch(r, o.v)).length
                    return (
                      <button
                        key={o.v}
                        type="button"
                        className="uc-chip"
                        aria-pressed={st.chip === o.v}
                        onClick={() => patch({ chip: o.v, page: 1 })}
                      >
                        {o.l}
                        <span className="uc-chip-count uc-num">{fmtInt(count)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
              {cfg.dateKey ? (
                <div className="uc-date-range" role="group" aria-label={`Rango de fechas de ${cfg.dateLabel?.toLowerCase()}`}>
                  <span>{cfg.dateLabel}</span>
                  {(['from', 'to'] as const).map((k, i) => (
                    <span key={k} style={{ display: 'contents' }}>
                      {i === 1 ? <span aria-hidden="true">–</span> : null}
                      <div className="uc-date-field">
                        <input
                          className="uc-field uc-num"
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="dd/mm/aaaa"
                          title={`${k === 'from' ? 'Desde' : 'Hasta'} (dd/mm/aaaa)`}
                          aria-label={`${k === 'from' ? 'Desde' : 'Hasta'} (dd/mm/aaaa)`}
                          value={st[k]}
                          aria-invalid={st[k].length === 10 && !parseDMY(st[k])}
                          onChange={(e) => patch({ [k]: maskDate(e.target.value), page: 1 })}
                        />
                      </div>
                    </span>
                  ))}
                </div>
              ) : null}
              {(cfg.selects ?? []).map((s) => (
                <label key={s.key}>
                  <span className="uc-sr-only">{s.label}</span>
                  <select
                    className="uc-field"
                    value={st.sel[s.key] ?? ''}
                    onChange={(e) => patch({ sel: { ...st.sel, [s.key]: e.target.value }, page: 1 })}
                  >
                    <option value="">{s.all}</option>
                    {selectOptions[s.key].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {cfg.searchKeys ? (
              <label className="uc-search">
                <Icon name="search" size="sm" />
                <span className="uc-sr-only">Buscar</span>
                <input
                  className="uc-field"
                  type="search"
                  placeholder={cfg.searchPlaceholder ?? 'Buscar'}
                  value={st.q}
                  onChange={(e) => patch({ q: e.target.value, page: 1 })}
                />
              </label>
            ) : null}
          </div>
          <div className="uc-result-bar">
            <span aria-live="polite">
              <b className="uc-num">{fmtInt(total)}</b> {cfg.summary?.noun ?? 'resultados'}
              {sumValue != null ? (
                <>
                  {' '}
                  · <b className="uc-num">{money(sumValue)}</b> {cfg.summary?.sumLabel}
                </>
              ) : null}
            </span>
            {active ? (
              <button
                type="button"
                className="uc-link-btn"
                onClick={() => setSt((s) => ({ ...s, chip: 'all', q: '', from: '', to: '', sel: {}, page: 1 }))}
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="uc-table-scroll" ref={scroller}>
        <table className={`uc-dt ${cfg.sheet ? '' : 'uc-stackable'}`}>
          <thead>
            <tr>
              {cfg.sheet ? (
                <th className="uc-rownum" scope="col">
                  #
                </th>
              ) : null}
              {cfg.columns.map((c) => {
                const sortable = c.sortable !== false && hasToolbar && c.kind !== 'actions'
                const on = st.sort === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`${c.align ? `uc-${c.align}` : ''} ${sortable ? 'uc-sortable' : ''}`}
                    aria-sort={on ? (st.dir === 1 ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
                    tabIndex={sortable ? 0 : undefined}
                    onClick={sortable ? () => sortBy(c.key) : undefined}
                    onKeyDown={
                      sortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              sortBy(c.key)
                            }
                          }
                        : undefined
                    }
                  >
                    {c.kind === 'actions' ? <span className="uc-sr-only">{c.label}</span> : c.label}
                    {sortable ? (
                      <span className="uc-sort-ind" aria-hidden="true">
                        {on ? (st.dir === 1 ? '↑' : '↓') : '↕'}
                      </span>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((r, i) => (
                <tr key={r.id}>
                  {cfg.sheet ? <td className="uc-rownum uc-num">{start + i + 1}</td> : null}
                  {cfg.columns.map((c) => {
                    const numeric = c.kind === 'num' || c.kind === 'money' || c.kind === 'pct' || c.kind === 'date' || c.kind === 'datetime'
                    return (
                      <td
                        key={c.key}
                        data-label={c.kind === 'actions' ? '' : c.label}
                        className={[c.align ? `uc-${c.align}` : '', numeric ? 'uc-num' : '', c.amount ? 'uc-amount' : '', c.muted ? 'uc-muted' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="uc-cv">
                          <RenderCell col={c} row={r} />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))
            ) : (
              <tr className="uc-empty">
                <td colSpan={cfg.columns.length + (cfg.sheet ? 1 : 0)}>{cfg.empty ?? 'No hay resultados con estos filtros.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageSize && total > 0 ? (
        <div className="uc-pager">
          <span className="uc-num">
            Mostrando {total ? start + 1 : 0}–{start + pageRows.length} de {fmtInt(total)}
          </span>
          <nav className="uc-pages" aria-label="Paginado">
            <button
              type="button"
              className="uc-pg"
              disabled={page === 1}
              aria-label="Página anterior"
              onClick={() => {
                patch({ page: page - 1 })
                scroller.current?.scrollTo({ top: 0 })
              }}
            >
              ‹
            </button>
            {nums.map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="uc-pg" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className="uc-pg uc-num"
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => {
                    patch({ page: p })
                    scroller.current?.scrollTo({ top: 0 })
                  }}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              className="uc-pg"
              disabled={page === pages}
              aria-label="Página siguiente"
              onClick={() => {
                patch({ page: page + 1 })
                scroller.current?.scrollTo({ top: 0 })
              }}
            >
              ›
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  )
}

export type { Tone }
