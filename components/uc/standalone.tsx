import { BrandMark } from '@/components/brand-mark'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Marco de las pantallas de cuenta que viven fuera del panel (seguridad, verificacion en dos pasos,
 * retorno de identidad): carga los tokens del sistema de diseno (clase "uc") y, si bar=true, una barra con la marca.
 * El CSS (app/uc.css) lo importa cada layout de ruta.
 */
export function UcStandalone({ children, homeHref = '/', bar = true }: { children: ReactNode; homeHref?: string; bar?: boolean }) {
  return (
    <div className="uc uc-standalone">
      {bar ? (
        <header className="uc-standalone-bar">
          <Link href={homeHref} className="uc-brand-link" aria-label="Unicréditos" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandMark className="uc-logo-mark-svg" tone="white" />
            <span className="uc-wordmark">Unicréditos</span>
          </Link>
        </header>
      ) : null}
      {children}
    </div>
  )
}