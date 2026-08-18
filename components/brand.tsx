import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  showText = true,
  invert = false,
}: {
  className?: string
  showText?: boolean
  invert?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/unicred-logo.png"
        alt="UniCred"
        width={32}
        height={32}
        className="h-8 w-8 rounded-md object-contain"
      />
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'text-lg font-bold tracking-tight',
              invert ? 'text-sidebar-foreground' : 'text-foreground',
            )}
          >
            UniCred
          </span>
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-widest',
              invert ? 'text-sidebar-foreground/60' : 'text-muted-foreground',
            )}
          >
            by Unipagos
          </span>
        </span>
      )}
    </span>
  )
}
