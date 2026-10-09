'use client'

import { Icon } from '@/components/uc/icons'

interface PrintButtonProps {
  label?: string
  title?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'subtle'
  size?: 'sm' | 'xs' | 'md'
  onBeforePrint?: () => void
}

export function PrintButton({
  label = 'Print',
  title = 'Imprimir reporte actual (abre el cuadro de diálogo de impresión del navegador)',
  className = '',
  variant = 'secondary',
  size = 'xs',
  onBeforePrint,
}: PrintButtonProps) {
  const handlePrint = () => {
    if (onBeforePrint) {
      try {
        onBeforePrint()
      } catch (err) {
        console.error('Error in onBeforePrint callback:', err)
      }
    }
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  // Base styling depending on variant
  const variantStyles = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 shadow-xs',
    outline:
      'border border-blue-600/30 bg-blue-50/70 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50 shadow-xs',
    subtle:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800',
  }[variant]

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-xs font-semibold gap-2',
    md: 'px-3.5 py-2 text-sm font-semibold gap-2',
  }[size]

  return (
    <button
      type="button"
      onClick={handlePrint}
      title={title}
      aria-label={label}
      className={`no-print inline-flex items-center justify-center font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      <Icon name="print" size="xs" />
      <span>{label}</span>
    </button>
  )
}
