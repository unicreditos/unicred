import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import type { ReactNode } from 'react'

/** 404 y error de ruta: mismo chrome que el sitio, sin pedir sesión. */
export function PublicErrorFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicFooter />
    </div>
  )
}
