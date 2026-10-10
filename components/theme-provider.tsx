'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { isPublicPath } from '@/lib/public-routes'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // El sitio público es solo claro: ignora el modo oscuro del sistema y el guardado del usuario.
  const pathname = usePathname()
  const forcedTheme = isPublicPath(pathname) ? 'light' : props.forcedTheme

  // Sincroniza clase .dark de Tailwind con atributo data-theme para el subsistema .uc
  React.useEffect(() => {
    const syncDataTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
      // En el sitio público el claro es forzado: no se guarda como preferencia del usuario.
      if (isPublicPath(window.location.pathname)) return
      try {
        localStorage.setItem('uc-theme', isDark ? 'dark' : 'light')
      } catch {}
    }

    syncDataTheme()

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          syncDataTheme()
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}
