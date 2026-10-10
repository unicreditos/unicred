import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Paleta única de estados para todo el backoffice. Cada tabla (créditos, KYC,
 * comercios, desembolsos) mapea su propio vocabulario de status a uno de
 * estos tonos, así "Pendiente" o "Activo" se ven exactamente igual sin
 * importar en qué pantalla estén.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'complete' | 'neutral'

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success/10 text-success border-success/20', dot: 'bg-success' },
  warning: { pill: 'bg-warning/10 text-warning border-warning/20', dot: 'bg-warning' },
  danger: { pill: 'bg-destructive/10 text-destructive border-destructive/20', dot: 'bg-destructive' },
  info: { pill: 'bg-brand-primary/10 text-brand-primary-800 border-brand-primary/20', dot: 'bg-brand-primary' },
  complete: { pill: 'bg-muted text-brand-navy-700 border-border', dot: 'bg-brand-navy-400' },
  neutral: { pill: 'bg-muted text-muted-foreground border-transparent', dot: 'bg-muted-foreground' },
}

export function StatusPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  dot?: boolean
  className?: string
}) {
  const cfg = TONE_CLASSES[tone]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        cfg.pill,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} /> : null}
      {children}
    </span>
  )
}
