'use client'

import { BrandMark } from '@/components/brand-mark'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/uc/icons'
import { signOut } from '@/lib/auth-client'

export type MenuChild = { label: string; route: string }
export type MenuItem = {
  id: string
  label: string
  icon: IconName
  route?: string
  children?: MenuChild[]
}
export type BottomItem = { route?: string; label: string; icon: IconName; match?: string }

type Props = {
  menu: MenuItem[]
  /** "Backoffice", "Mi cuenta"…: se muestra bajo la marca. */
  area: string
  user: { name: string; detail: string; email?: string }
  today: string
  bottomNav?: BottomItem[]
  /** Inicio del panel: la marca lleva acá, nunca al sitio público (el panel está aislado). */
  homeHref: string
  children: ReactNode
}

const MQ = '(max-width:1024px)'
const subscribeMq = (cb: () => void) => {
  const mq = window.matchMedia(MQ)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useIsDrawer = () =>
  useSyncExternalStore(subscribeMq, () => window.matchMedia(MQ).matches, () => false)

/* Tema claro/oscuro: se guarda en localStorage y se aplica en <html data-theme>. */
const subscribeTheme = (cb: () => void) => {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
const useTheme = () =>
  useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    () => 'light',
  )

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase()
}

function matchScore(pathname: string, route: string) {
  if (pathname === route) return route.length + 1
  if (pathname.startsWith(`${route}/`)) return route.length
  return 0
}

export function UcShell({ menu, area, user, today, bottomNav, homeHref, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const isDrawer = useIsDrawer()
  const theme = useTheme()

  const sidebarRef = useRef<HTMLElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const hovering = useRef(false)
  const [open, setOpen] = useState(false) // riel expandido por hover/foco (escritorio)
  const [drawer, setDrawer] = useState(false) // menú lateral en tablet/celular
  const [userMenu, setUserMenu] = useState(false)

  /* Ruta activa: la coincidencia más larga entre ítems y sub-ítems. */
  let active: { group: MenuItem; label: string; route: string } | null = null
  let best = 0
  for (const g of menu) {
    const candidates = g.children ? g.children.map((c) => ({ label: c.label, route: c.route })) : g.route ? [{ label: g.label, route: g.route }] : []
    for (const c of candidates) {
      const s = matchScore(pathname, c.route)
      if (s > best) {
        best = s
        active = { group: g, label: c.label, route: c.route }
      }
    }
  }

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(active?.group.children ? [active.group.id] : []))

  useEffect(() => {
    // Al navegar: se cierra el menú y se abre el grupo de la pantalla nueva (evita setState en render → hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawer(false)
    setUserMenu(false)
    let best = 0
    let groupId: string | null = null
    let hasChildren = false
    for (const g of menu) {
      const candidates = g.children ? g.children.map((c) => c.route) : g.route ? [g.route] : []
      for (const route of candidates) {
        const s = matchScore(pathname, route)
        if (s > best) {
          best = s
          groupId = g.id
          hasChildren = Boolean(g.children)
        }
      }
    }
    setExpanded(new Set(groupId && hasChildren ? [groupId] : []))
  }, [pathname, menu])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawer(false)
      setUserMenu(false)
      setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenu(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('uc-no-scroll', drawer)
    return () => document.body.classList.remove('uc-no-scroll')
  }, [drawer])

  const toggleGroup = (id: string) =>
    // Acordeón: abrir un grupo cierra los demás.
    setExpanded((prev) => (prev.has(id) ? new Set() : new Set([id])))

  /** Al dejar de usar el menú lateral (escritorio), los submenús se pliegan. */
  const collapseRail = () => {
    setOpen(false)
    setExpanded((prev) => (prev.size ? new Set() : prev))
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('uc-theme', next)
    } catch {
      // modo privado: el tema solo dura esta visita
    }
  }

  function logout() {
    void signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace('/')
          router.refresh()
        },
      },
    })
  }

  const sidebarOpen = isDrawer ? true : open
  const crumbs = active
    ? [...(active.group.children ? [active.group.label] : []), ...(active.label === active.group.label && active.group.children ? [] : [active.label])]
    : []

  return (
    <div className={`uc ${bottomNav ? 'uc-has-bottom-nav' : ''}`}>
      <aside
        id="uc-sidebar"
        ref={sidebarRef}
        aria-label="Navegación principal"
        inert={isDrawer && !drawer ? true : undefined}
        className={`uc-sidebar ${sidebarOpen ? 'uc-is-open' : ''} ${drawer ? 'uc-drawer-open' : ''}`}
        onMouseEnter={() => {
          if (isDrawer) return
          hovering.current = true
          setOpen(true)
        }}
        onMouseLeave={() => {
          if (isDrawer) return
          hovering.current = false
          // Tras un clic el foco queda en el enlace: se suelta para que el menú se pliegue al salir el mouse.
          const el = document.activeElement
          if (el instanceof HTMLElement && sidebarRef.current?.contains(el) && el.matches(':not(:focus-visible)')) el.blur()
          if (!sidebarRef.current?.contains(document.activeElement)) collapseRail()
        }}
        onFocus={() => {
          if (!isDrawer) setOpen(true)
        }}
        onBlur={(e) => {
          if (!isDrawer && !sidebarRef.current?.contains(e.relatedTarget as Node) && !hovering.current) collapseRail()
        }}
      >
        <div className="uc-sb-brand">
          <Link href={homeHref} className="uc-brand-link" aria-label="Ir al inicio" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandMark className="uc-logo-mark-svg" tone="white" />
            <span className="uc-sb-label uc-wordmark">
              Unicréditos<small>{area}</small>
            </span>
          </Link>
        </div>
        <nav className="uc-sb-nav">
          <ul className="uc-sb-list">
            {menu.map((m) => {
              const isActiveGroup = active?.group.id === m.id
              if (m.children) {
                const isOpen = expanded.has(m.id)
                return (
                  <li key={m.id} className={`uc-sb-item ${isActiveGroup ? 'uc-is-active' : ''}`}>
                    <button
                      type="button"
                      className="uc-sb-link"
                      aria-expanded={isOpen}
                      aria-controls={`uc-sub-${m.id}`}
                      onClick={() => toggleGroup(m.id)}
                    >
                      <Icon name={m.icon} />
                      <span className="uc-sb-label">{m.label}</span>
                      <Icon name="chev" size="sm" className="uc-chev" />
                    </button>
                    <ul className="uc-sb-sub" id={`uc-sub-${m.id}`}>
                      {m.children.map((c) => (
                        <li key={c.route}>
                          <Link href={c.route} aria-current={active?.route === c.route ? 'page' : undefined}>
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              }
              return (
                <li key={m.id} className={`uc-sb-item ${isActiveGroup ? 'uc-is-active' : ''}`}>
                  <Link
                    className="uc-sb-link"
                    href={m.route ?? '#'}
                    aria-label={m.label}
                    aria-current={active?.route === m.route ? 'page' : undefined}
                  >
                    <Icon name={m.icon} />
                    <span className="uc-sb-label">{m.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="uc-sb-foot-note">UNICRÉDITOS · {area}</div>
      </aside>
      <div className={`uc-scrim ${drawer ? 'uc-show' : ''}`} aria-hidden="true" onClick={() => setDrawer(false)} />

      <div className="uc-app">
        <header className="uc-topbar">
          <button
            className="uc-icon-btn uc-menu-btn"
            type="button"
            aria-label={drawer ? 'Cerrar menú' : 'Abrir menú'}
            aria-controls="uc-sidebar"
            aria-expanded={drawer}
            onClick={() => setDrawer((d) => !d)}
          >
            <Icon name="menu" size="sm" />
          </button>
          <div className="uc-crumbs">
            {crumbs.map((c, i) =>
              i === crumbs.length - 1 ? (
                <b key={c}>{c}</b>
              ) : (
                <span key={c} style={{ display: 'contents' }}>
                  <span>{c}</span>
                  <span className="uc-sep" aria-hidden="true">
                    /
                  </span>
                </span>
              ),
            )}
          </div>
          <span className="uc-spacer" />
          <span className="uc-today">{today}</span>
          <button
            className="uc-icon-btn"
            type="button"
            onClick={toggleTheme}
            suppressHydrationWarning
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size="sm" />
          </button>

          <div className="uc-user" ref={userRef}>
            <button
              type="button"
              className="uc-user-btn"
              aria-haspopup="menu"
              aria-expanded={userMenu}
              onClick={() => setUserMenu((v) => !v)}
            >
              <span className="uc-avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="uc-user-name">
                <span>{user.name}</span>
                <small>{user.detail}</small>
              </span>
              <Icon name="chev" size="xs" style={{ transform: 'rotate(90deg)' }} />
            </button>
            {userMenu ? (
              <div className="uc-user-menu" role="menu">
                <div className="uc-who">
                  <b>{user.name}</b>
                  <small>{user.email || user.detail}</small>
                </div>
                <Link href="/cuenta/seguridad" role="menuitem">
                  <Icon name="lock" size="sm" />
                  Seguridad de la cuenta
                </Link>
                <button type="button" role="menuitem" className="uc-danger-item" onClick={logout}>
                  <Icon name="x" size="sm" />
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {bottomNav ? (
        <nav className="uc-bottom-nav" aria-label="Navegación inferior">
          {bottomNav.map((b) => {
            if (!b.route) {
              return (
                <button key={b.label} type="button" aria-controls="uc-sidebar" onClick={() => setDrawer(true)}>
                  <Icon name={b.icon} />
                  <span>{b.label}</span>
                </button>
              )
            }
            const on = pathname === b.route || (b.match ? new RegExp(b.match).test(pathname) : pathname.startsWith(`${b.route}/`))
            return (
              <Link key={b.route} href={b.route} aria-current={on ? 'page' : undefined}>
                <Icon name={b.icon} />
                <span>{b.label}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}
    </div>
  )
}
