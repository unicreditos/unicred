'use client'

export default function ContenidoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="uc-card uc-pad" role="alert">
      <h2 style={{ marginTop: 0, fontSize: 16 }}>No se pudo cargar esta sección</h2>
      <p className="uc-muted">Puede ser un corte momentáneo de la base o que falte aplicar el SQL de configuración (scripts/sql/2026-10-10_06_site_config.sql).</p>
      <button type="button" className="uc-btn uc-primary" onClick={reset}>
        Reintentar
      </button>
    </div>
  )
}
