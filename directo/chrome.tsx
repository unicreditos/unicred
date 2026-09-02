'use client'

import { DIRECTO, DIRECTO_HOME, DIRECTO_NAV } from '@/directo/copy'
import { directoSignupHref } from '@/directo/intent'
import { BRAND, GROUP, groupOperatorLine, groupSiblingUnits } from '@/lib/brand'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const CTA = directoSignupHref()

function Wordmark() {
  return (
    <Link href={DIRECTO_HOME} className="dx-word">
      <strong>{BRAND.company}</strong>
      <span>{GROUP.productLine}</span>
    </Link>
  )
}

export function DirectoHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="dx-top">
      <div className="dx-top-inner">
        <Wordmark />
        <nav className="dx-nav" aria-label="Campaña">
          {DIRECTO_NAV.map((item) => (
            <Link key={item.href} href={item.href} data-active={pathname === item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href={CTA} className="dx-btn dx-cta-desk">
          {DIRECTO.ctaPrimary}
        </Link>
        <button
          type="button"
          className="dx-burger"
          aria-expanded={open}
          aria-controls="dx-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Cerrar' : 'Menú'}
        </button>
      </div>
      <div
        id="dx-menu"
        className="dx-drawer"
        hidden={!open}
      >
        {DIRECTO_NAV.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link href={CTA} className="dx-btn" onClick={() => setOpen(false)}>
          {DIRECTO.ctaPrimary}
        </Link>
      </div>
    </header>
  )
}

export function DirectoFooter() {
  return (
    <footer className="dx-foot">
      <div className="dx-wrap">
        <Wordmark />
        <nav>
          {DIRECTO_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/contacto">Contacto</Link>
        </nav>
        <a href={`mailto:${DIRECTO.contactEmail}`}>{DIRECTO.contactEmail}</a>
        <small>{DIRECTO.companyLine}</small>
        <small>{groupOperatorLine()}</small>
        <nav aria-label={`Marcas de ${GROUP.name}`}>
          {groupSiblingUnits().map((unit) => (
            <a key={unit.id} href={unit.href} target="_blank" rel="noopener noreferrer">
              {unit.name}
            </a>
          ))}
        </nav>
        <small>{DIRECTO.nonBank}</small>
        <small>{DIRECTO.disclaimer}</small>
        <small>
          © {new Date().getFullYear()} {BRAND.company} · {GROUP.name} · unicreditos.com
        </small>
      </div>
    </footer>
  )
}

export function DirectoShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={['dx', className].filter(Boolean).join(' ')}>
      <DirectoHeader />
      <main>{children}</main>
      <DirectoFooter />
      <Link href={CTA} className="dx-btn dx-stick">
        {DIRECTO.ctaPrimary}
      </Link>
    </div>
  )
}
