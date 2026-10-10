'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type ContentTab = { href: string; label: string }

export function ContentTabs({ tabs }: { tabs: ContentTab[] }) {
  const path = usePathname()
  return (
    <nav className="uc-ctabs" aria-label="Secciones de configuración y contenido">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
