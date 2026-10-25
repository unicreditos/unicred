import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** Escudo con la "U" de Unicréditos. `white` es para fondos oscuros (marino). */
export function BrandMark({
  className,
  tone = 'brand',
}: {
  className?: string
  tone?: 'brand' | 'white'
}) {
  const white = tone === 'white'
  return (
    <svg viewBox="0 0 48 48" className={cn('h-5 w-5 shrink-0', className)} aria-hidden>
      {/* "U" abierta que sostiene un sol: el crédito que se te acredita, con el costo a la vista. */}
      <path
        d="M12 8v18a12 12 0 0 0 24 0V8"
        fill="none"
        stroke={white ? '#74ACDF' : '#0B1E3F'}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="5.2" fill="#F5B50F" />
    </svg>
  )
}

/** Marca + nombre. `light` = sobre fondo oscuro. */
export function BrandWordmark({
  light = false,
  subtitle = BRAND.slogan,
  className,
}: {
  light?: boolean
  subtitle?: string | null
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <BrandMark className="h-9 w-9" tone={light ? 'white' : 'brand'} />
      <span className="flex flex-col leading-none">
        <span className={cn('text-[19px] font-extrabold tracking-[-0.02em]', light ? 'text-white' : 'text-brand-navy-800')}>
          Unicréditos
        </span>
        {subtitle ? (
          <span
            className={cn(
              'mt-1 max-w-[10.5rem] text-balance text-[9.5px] font-semibold uppercase leading-[1.2] tracking-[0.1em]',
              light ? 'text-white/70' : 'text-brand-navy-500',
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  )
}
