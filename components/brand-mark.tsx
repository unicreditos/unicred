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
      <defs>
        <linearGradient id="uc-mark-g" x1="8" y1="3" x2="40" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A9CA4" />
          <stop offset="1" stopColor="#0A6A71" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 41.5 9.2v13.6c0 10.2-7.2 18.2-17.5 22.2C13.7 41 6.5 33 6.5 22.8V9.2L24 3Z"
        fill={white ? '#FFFFFF' : 'url(#uc-mark-g)'}
      />
      <path
        d="M17.2 15v10.4a6.8 6.8 0 0 0 13.6 0V15"
        fill="none"
        stroke={white ? '#0F2A4A' : '#FFFFFF'}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Marca + nombre. `light` = sobre fondo oscuro. */
export function BrandWordmark({
  light = false,
  subtitle = 'Préstamos personales',
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
              'mt-1 text-[11px] font-medium uppercase tracking-[0.12em]',
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
