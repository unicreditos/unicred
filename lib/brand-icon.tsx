import type { ReactElement } from 'react'

/** Escudo "U" para íconos de la app (favicon, apple-touch, manifest). Fondo marino, escudo blanco. */
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
        background: '#0F2A4A',
      }}
    >
      <svg width={shield} height={shield} viewBox="0 0 48 48">
        <path d="M24 3 41.5 9.2v13.6c0 10.2-7.2 18.2-17.5 22.2C13.7 41 6.5 33 6.5 22.8V9.2L24 3Z" fill="#FFFFFF" />
        <path
          d="M17.2 15v10.4a6.8 6.8 0 0 0 13.6 0V15"
          fill="none"
          stroke="#0C7C84"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
