import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import Link from 'next/link'

/** Marca producto: U abierta + punto signal. */
export function PedirMark({
  className,
  size = 36,
  tone = 'dark',
}: {
  className?: string
  size?: number
  tone?: 'dark' | 'light'
}) {
  const onDark = tone === 'light'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={BRAND.company}
    >
      <rect width="64" height="64" rx="18" fill={onDark ? 'rgba(244,246,248,0.08)' : '#060D14'} />
      <path
        d="M18 16v22c0 8.837 7.163 16 16 16s16-7.163 16-16V16"
        fill="none"
        stroke="#F4F6F8"
        strokeWidth="5.25"
        strokeLinecap="round"
      />
      <circle cx="48" cy="16" r="4" fill="#0D9F8F" />
    </svg>
  )
}

export function PedirLogo({
  href = '/pedir',
  variant = 'full',
  tone = 'dark',
  className,
}: {
  href?: string
  variant?: 'full' | 'mark' | 'word'
  tone?: 'dark' | 'light'
  className?: string
}) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5', className)} aria-label={BRAND.company}>
      {variant !== 'word' ? <PedirMark size={variant === 'mark' ? 40 : 34} tone={tone} /> : null}
      {variant !== 'mark' ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              'truncate font-[family-name:var(--font-lp-display)] text-[1.15rem] font-bold tracking-[-0.04em] sm:text-[1.3rem]',
              tone === 'light' ? 'text-[#f4f6f8]' : 'text-[var(--lp-ink)]',
            )}
          >
            {BRAND.company}
          </span>
          <span
            className={cn(
              'mt-1 text-[9px] font-bold uppercase tracking-[0.16em]',
              tone === 'light' ? 'text-white/45' : 'text-[var(--lp-muted)]',
            )}
          >
            Crédito personal
          </span>
        </span>
      ) : null}
    </Link>
  )
}

export function PedirMarkPng({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/pedir/logo-mark.png"
      alt={BRAND.company}
      width={size}
      height={size}
      className={cn('rounded-2xl', className)}
      priority
    />
  )
}
