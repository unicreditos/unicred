'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Sincroniza clase .dark de Tailwind con atributo data-theme para el subsistema .uc
  React.useEffect(() => {
    const syncDataTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
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

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
