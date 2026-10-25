import type { ReactElement } from 'react'

/** "U" con sol para íconos de la app (favicon, apple-touch, manifest). Fondo marino, U celeste y sol. */
export function brandIconElement(px: number): ReactElement {
  const shield = Math.round(px * 0.62)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B1E3F',
      }}
    >
      <svg width={shield} height={shield} viewBox="0 0 48 48">
        <path d="M12 8v18a12 12 0 0 0 24 0V8" fill="none" stroke="#74ACDF" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="5.2" fill="#F5B50F" />
      </svg>
    </div>
  )
}
