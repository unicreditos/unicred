export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="uc-sr-only">Cargando…</span>
      <div className="uc-page-head">
        <div>
          <div style={{ height: 28, width: 220, borderRadius: 8, background: 'var(--uc-surface-3)' }} />
          <div style={{ height: 14, width: 320, maxWidth: '100%', borderRadius: 7, background: 'var(--uc-surface-3)', marginTop: 10 }} />
        </div>
      </div>
      <div className="uc-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="uc-kpi" style={{ minHeight: 120, background: 'var(--uc-surface-2)' }} />
        ))}
      </div>
    </div>
  )
}
