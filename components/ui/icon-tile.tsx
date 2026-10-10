import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const SIZES = {
  sm: 'h-9 w-9 rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px]',
  md: 'h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5',
  lg: 'h-14 w-14 rounded-2xl [&_svg]:h-6 [&_svg]:w-6',
} as const

const TONES = {
  soft: 'bg-brand-primary-50 text-brand-primary-700 ring-1 ring-brand-primary/15',
  solid: 'bg-brand-primary text-white shadow-sm shadow-brand-primary/30',
  navy: 'bg-brand-navy-800 text-brand-primary-300',
  onDark: 'bg-white/10 text-brand-primary-300 ring-1 ring-white/15',
} as const

/** Contenedor de ícono: mismo tamaño, trazo y color en todo el sitio. */
export function IconTile({
  children,
  size = 'md',
  tone = 'soft',
  className,
}: {
  children: ReactNode
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[1.75]',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
