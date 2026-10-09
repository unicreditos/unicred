'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeSwitcherProps {
  className?: string
  showLabel?: boolean
  variant?: 'icon' | 'pill'
}

export function ThemeSwitcher({ className, showLabel = false, variant = 'icon' }: ThemeSwitcherProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Cambiando tema"
        className={cn(
          'inline-flex items-center justify-center rounded-xl border border-border/50 bg-background/50 p-2 text-muted-foreground opacity-60',
          className,
        )}
      >
        <span className="h-4 w-4" />
        {showLabel && <span className="ml-2 text-xs font-medium">Tema</span>}
      </button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    // Sincroniza inmediatamente data-theme para .uc
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('uc-theme', next)
    } catch {}
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition hover:bg-muted hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          className,
        )}
      >
        {isDark ? (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span>Modo claro</span>
          </>
        ) : (
          <>
            <Moon className="h-3.5 w-3.5 text-slate-700" />
            <span>Modo oscuro</span>
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-foreground shadow-xs transition hover:bg-muted hover:text-emerald-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-emerald-400',
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="ml-2 text-xs font-medium">
          {isDark ? 'Claro' : 'Oscuro'}
        </span>
      )}
    </button>
  )
}
