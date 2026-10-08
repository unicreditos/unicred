/**
 * Trama de seguridad estilo billete/pagaré. Es solo ornamento: se genera en el servidor
 * y no suma JavaScript al cliente.
 */

/** Roseta: elipses giradas alrededor del mismo centro, como en un billete. */
export function Rosette({ className }: { className?: string }) {
  const outer = Array.from({ length: 36 }, (_, i) => i * 5)
  const inner = Array.from({ length: 24 }, (_, i) => i * 7.5 + 2.5)
  return (
    <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="0.7" aria-hidden="true" className={className}>
      <g transform="translate(200 200)">
        {outer.map((deg) => (
          <ellipse key={`o${deg}`} rx="192" ry="68" transform={`rotate(${deg})`} />
        ))}
        {inner.map((deg) => (
          <ellipse key={`i${deg}`} rx="118" ry="38" transform={`rotate(${deg})`} />
        ))}
        <circle r="22" />
        <circle r="10" />
      </g>
    </svg>
  )
}

/** Ondas finas superpuestas, desfasadas: la banda de color de un cupón. */
export function Waves({ className }: { className?: string }) {
  const width = 600
  const height = 72
  const lines = Array.from({ length: 16 }, (_, n) => {
    const phase = n * 0.34
    const amp = 10 + n * 1.1
    let d = ''
    for (let x = 0; x <= width; x += 6) {
      const y = height / 2 + amp * Math.sin((x / width) * Math.PI * 5 + phase)
      d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
    }
    return d
  })
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
      aria-hidden="true"
      className={className}
    >
      {lines.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
