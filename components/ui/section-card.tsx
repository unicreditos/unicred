import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Tarjeta de sección del tablero: título, descripción corta, un enlace de "ver todo" y el contenido. */
export function SectionCard({
  title,
  description,
  href,
  hrefLabel = 'Ver todo',
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  description?: string
  href?: string
  hrefLabel?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
          {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
        {action ??
          (href ? (
            <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-primary hover:underline">
              {hrefLabel}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null)}
      </div>
      <div className={cn('min-w-0 flex-1 px-5 pb-5 sm:px-6', bodyClassName)}>{children}</div>
    </Card>
  )
}
