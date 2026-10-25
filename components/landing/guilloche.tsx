/**
 * Roseta guilloche: elipses finas rotadas alrededor de un centro, el patrón de seguridad de billetes y documentos
 * de valor. Decorativa (aria-hidden); el color y la opacidad salen de la clase .uc-guilloche.
 */
export function Guilloche({ className, petals = 36 }: { className?: string; petals?: number }) {
  const items = Array.from({ length: petals }, (_, i) => (i * 180) / petals)
  return (
    <div className={`uc-guilloche pointer-events-none ${className ?? ''}`} aria-hidden>
      <svg viewBox="-200 -200 400 400" className="h-full w-full">
        <g fill="none" stroke="currentColor" strokeWidth="0.6">
          {items.map((deg) => (
            <ellipse key={`a${deg}`} rx="190" ry="62" transform={`rotate(${deg})`} />
          ))}
          {items.map((deg) => (
            <ellipse key={`b${deg}`} rx="120" ry="34" transform={`rotate(${deg + 90 / items.length})`} />
          ))}
          <circle r="196" />
          <circle r="150" strokeDasharray="1 4" />
        </g>
      </svg>
    </div>
  )
}
