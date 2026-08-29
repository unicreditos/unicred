'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AccountAvatar } from '@/components/unicred/account-avatar'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { NotificationCenter } from '@/components/unicred/notification-center'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { ChevronDown, LayoutGrid, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, User, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'

export type WorkspaceRole = 'customer' | 'admin' | 'merchant'

export type WorkspaceNavChild = {
  id: string
  label: string
  subtitle?: string
}

export type WorkspaceNavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group?: string
  count?: number
  children?: readonly WorkspaceNavChild[]
}

const ROLE_META: Record<WorkspaceRole, { eyebrow: string; homeLabel: string; homeHref: string }> = {
  customer: { eyebrow: 'Cuenta', homeLabel: 'Inicio', homeHref: '/dashboard' },
  admin: { eyebrow: 'Ejecutivo', homeLabel: 'Dashboard', homeHref: '/admin' },
  merchant: { eyebrow: 'Comercio', homeLabel: 'Inicio', homeHref: '/merchant' },
}

const SIDEBAR_KEY = 'uc-sidebar-collapsed'
const GROUPS_KEY = 'uc-nav-groups'

function subscribeStorage(onStore: () => void) {
  window.addEventListener('storage', onStore)
  window.addEventListener('uc-storage', onStore)
  return () => {
    window.removeEventListener('storage', onStore)
    window.removeEventListener('uc-storage', onStore)
  }
}

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

const EMPTY_GROUPS: Record<string, boolean> = Object.freeze({})
let groupsSnapshotRaw = ''
let groupsSnapshot: Record<string, boolean> = EMPTY_GROUPS

function readGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY) || '{}'
    if (raw === groupsSnapshotRaw) return groupsSnapshot
    const parsed = JSON.parse(raw) as Record<string, boolean>
    groupsSnapshotRaw = raw
    groupsSnapshot = parsed
    return groupsSnapshot
  } catch {
    return groupsSnapshot
  }
}

function getServerGroups() {
  return EMPTY_GROUPS
}

function writeStorage() {
  window.dispatchEvent(new Event('uc-storage'))
}

export function WorkspaceShell({
  role,
  nav,
  activeId,
  onNavigate,
  title,
  subtitle,
  user,
  children,
  onProfile,
  accountItems,
  mobileTabs,
}: {
  role: WorkspaceRole
  nav: WorkspaceNavItem[]
  activeId: string
  onNavigate: (id: string) => void
  title: string
  subtitle?: string
  user: { name?: string | null; email?: string | null; image?: string | null }
  children: ReactNode
  onProfile?: () => void
  accountItems?: { label: string; onSelect: () => void }[]
  mobileTabs?: WorkspaceNavItem[]
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = useSyncExternalStore(subscribeStorage, () => readFlag(SIDEBAR_KEY), () => false)
  const closedGroups = useSyncExternalStore(subscribeStorage, readGroups, getServerGroups)
  // Menú de cuenta (Base UI) solo en cliente: evita mismatch de ids/aria en hidratación.
  const clientReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [closedMenus, setClosedMenus] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const meta = ROLE_META[role]
  const activeParent = nav.find((n) => n.id === activeId || n.children?.some((c) => c.id === activeId))
  const activeChild = activeParent?.children?.find((c) => c.id === activeId)
  const active = activeParent && (activeChild ? { ...activeParent, label: activeChild.label } : activeParent)
  const grouped = useMemo(() => {
    const out: { group: string | null; items: WorkspaceNavItem[] }[] = []
    for (const item of nav) {
      const g = item.group ?? null
      const last = out[out.length - 1]
      if (!last || last.group !== g) out.push({ group: g, items: [item] })
      else last.items.push(item)
    }
    return out
  }, [nav])

  const persistCollapsed = (next: boolean) => {
    window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
    writeStorage()
  }

  const toggleGroup = (group: string) => {
    const next = { ...closedGroups, [group]: !closedGroups[group] }
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next))
    writeStorage()
  }

  const go = (id: string) => {
    onNavigate(id)
    setMobileOpen(false)
  }

  const renderNav = (compact: boolean) => (
    <nav className={cn('flex-1 space-y-4 overflow-y-auto py-3 uc-scroll-thin', compact ? 'px-2' : 'space-y-5 px-3')}>
      {grouped.map((block, i) => {
        const groupClosed = Boolean(block.group && closedGroups[block.group] && !compact)
        return (
          <div key={`${block.group ?? 'g'}-${i}`}>
            {block.group && !compact ? (
              <button
                type="button"
                onClick={() => toggleGroup(block.group!)}
                className="mb-1.5 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] font-semibold text-white/45 hover:bg-white/6 hover:text-white/70"
              >
                <span>{block.group}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition', groupClosed ? '-rotate-90' : 'rotate-0')} />
              </button>
            ) : null}
            {groupClosed ? null : (
              <div className="space-y-1">
                {block.items.map((item) => {
                  const kids = item.children ?? []
                  const childActive = kids.some((c) => c.id === activeId)
                  const isOpen = kids.length > 0 && (childActive || item.id === activeId) && !closedMenus[item.id]
                  const isActive = item.id === activeId && !childActive
                  const Icon = item.icon
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        title={compact ? item.label : undefined}
                        aria-label={item.label}
                        aria-expanded={kids.length ? isOpen : undefined}
                        onClick={() => {
                          if (!kids.length) {
                            go(item.id)
                            return
                          }
                          if (compact) {
                            go(kids[0].id)
                            persistCollapsed(false)
                            return
                          }
                          if (childActive || item.id === activeId) {
                            setClosedMenus((m) => ({ ...m, [item.id]: !m[item.id] }))
                            return
                          }
                          setClosedMenus((m) => ({ ...m, [item.id]: false }))
                          go(kids[0].id)
                        }}
                        className={cn(
                          'flex w-full items-center text-left transition',
                          compact
                            ? 'h-12 justify-center rounded-xl'
                            : 'gap-3 rounded-xl px-2.5 py-3 text-[14px]',
                          isActive
                            ? 'bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_0_#20BD5A]'
                            : childActive
                              ? 'font-semibold text-white'
                              : 'font-medium text-white/75 hover:bg-white/8 hover:text-white',
                        )}
                      >
                        <Icon
                          className={cn(
                            'shrink-0',
                            'h-6 w-6',
                            isActive || childActive ? 'text-brand-cian-300' : 'text-white/70',
                          )}
                        />
                        {compact ? null : (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {typeof item.count === 'number' && item.count > 0 ? (
                              <span className="rounded-md bg-white/12 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white/80">
                                {item.count > 99 ? '99+' : item.count}
                              </span>
                            ) : null}
                            {kids.length ? (
                              <ChevronDown
                                className={cn('h-4 w-4 shrink-0 text-white/40 transition', isOpen ? 'rotate-0' : '-rotate-90')}
                              />
                            ) : null}
                          </>
                        )}
                      </button>
                      {!compact && kids.length && isOpen ? (
                        <div className="mb-1 ml-4 mt-0.5 space-y-px border-l border-white/10 pl-2">
                          {kids.map((child) => {
                            const on = child.id === activeId
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => go(child.id)}
                                className={cn(
                                  'flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] transition',
                                  on
                                    ? 'bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_0_#20BD5A]'
                                    : 'font-medium text-white/55 hover:bg-white/6 hover:text-white',
                                )}
                              >
                                <span className="truncate">{child.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-svh bg-[#F4F6F9] text-foreground">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col bg-brand-navy-900 transition-[width] duration-200 md:flex',
          collapsed ? 'w-20' : 'w-[248px]',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-white/8', collapsed ? 'justify-center px-2' : 'px-4')}>
          <BrandLogo href={meta.homeHref} showText={!collapsed} light className="[&_span.flex]:gap-0" />
        </div>
        {collapsed ? null : (
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium text-brand-cian-300/80">{meta.eyebrow}</div>
        )}
        {renderNav(collapsed)}
        <div className={cn('border-t border-white/8', collapsed ? 'p-2' : 'px-3 py-3')}>
          <button
            type="button"
            onClick={() => persistCollapsed(!collapsed)}
            className={cn(
              'flex w-full items-center rounded-xl text-white/70 transition hover:bg-white/8 hover:text-white',
              collapsed ? 'h-12 justify-center' : 'gap-3 px-2.5 py-2.5 text-[13px]',
            )}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-5 w-5" />}
            {collapsed ? null : <span>Colapsar menú</span>}
          </button>
          {collapsed ? null : (
            <p
              className="mt-2 px-1 text-[10px] leading-relaxed text-white/35"
              aria-label="UNICRÉDITOS · Grupo Emprenor. Créditos sujetos a evaluación"
            >
              <span className="block">UNICRÉDITOS · Grupo Emprenor</span>
              <span className="block" aria-hidden="true">
                Créditos sujetos a evaluación
              </span>
            </p>
          )}
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[248px] flex-col bg-brand-navy-900">
            <div className="flex h-16 items-center justify-between border-b border-white/8 px-4">
              <BrandLogo href={meta.homeHref} showText light />
              <button type="button" onClick={() => setMobileOpen(false)} className="text-white/70">
                <X className="h-6 w-6" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      ) : null}

      <div className={cn('flex min-h-svh min-w-0 flex-1 flex-col transition-[padding] duration-200', collapsed ? 'md:pl-20' : 'md:pl-[248px]')}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold tracking-tight text-brand-navy-800">
              {title || active?.label || meta.homeLabel}
            </div>
            {subtitle ? <p className="truncate text-[12px] text-slate-500">{subtitle}</p> : null}
          </div>
          <form
            className="hidden min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:flex"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = query.trim()
              if (!q) return
              const enc = encodeURIComponent(q)
              if (role === 'admin') router.push(`/admin?tab=solicitudes&q=${enc}`)
              else if (role === 'merchant') router.push(`/merchant?tab=sales&q=${enc}`)
              else router.push(`/dashboard?tab=cuotas&q=${enc}`)
            }}
          >
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={role === 'admin' ? 'Buscar solicitudes' : 'Buscar créditos'}
              aria-label={role === 'admin' ? 'Buscar solicitudes' : 'Buscar créditos'}
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400"
            />
          </form>
          <NotificationCenter />
          {clientReady ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-50">
                <AccountAvatar name={user.name} email={user.email} image={user.image} size="md" />
                <span className="hidden max-w-[170px] truncate text-left sm:inline">
                  <span className="block text-[13px] font-semibold text-slate-800">{user.name ?? 'Cuenta'}</span>
                  <span className="block text-[11px] text-slate-500">{user.email}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <div className="flex items-center gap-3 px-1 py-2">
                  <AccountAvatar name={user.name} email={user.email} image={user.image} size="lg" editable />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{user.name ?? 'Usuario'}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    <p className="mt-1 text-[11px] text-slate-500">JPG, PNG o WebP · máx. 1,5 MB</p>
                  </div>
                </div>
                {onProfile || accountItems?.length ? (
                  <>
                    <DropdownMenuSeparator />
                    {onProfile ? (
                      <DropdownMenuItem className="gap-2" onClick={onProfile}>
                        <User className="h-4 w-4" /> Identidad
                      </DropdownMenuItem>
                    ) : null}
                    {accountItems?.map((item) => (
                      <DropdownMenuItem key={item.label} onClick={item.onSelect}>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={() =>
                    signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          router.replace('/')
                          router.refresh()
                        },
                      },
                    })
                  }
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1" aria-hidden>
              <AccountAvatar name={user.name} email={user.email} image={user.image} size="md" />
              <span className="hidden max-w-[170px] truncate text-left sm:inline">
                <span className="block text-[13px] font-semibold text-slate-800">{user.name ?? 'Cuenta'}</span>
                <span className="block text-[11px] text-slate-500">{user.email}</span>
              </span>
            </div>
          )}
        </header>
        <main className={cn('flex-1 px-4 py-5 sm:px-6 lg:px-8', mobileTabs?.length ? 'pb-24 md:pb-8' : '')}>{children}</main>
      </div>

      {mobileTabs?.length ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {(mobileTabs.length ? mobileTabs : nav).slice(0, 4).map((item) => {
              const Icon = item.icon
              const on = item.id === activeId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium',
                    on ? 'text-brand-primary' : 'text-slate-500',
                  )}
                >
                  <Icon className={cn('h-6 w-6', on ? 'text-brand-primary' : 'text-slate-400')} />
                  {item.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium text-slate-500"
            >
              <LayoutGrid className="h-6 w-6 text-slate-400" />
              Más
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

export function PageIntro({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{kicker}</p> : null}
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-navy-900 sm:text-[22px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function DecisionBanner({
  tone,
  title,
  detail,
  action,
}: {
  tone: 'critical' | 'warn' | 'ok' | 'info'
  title: string
  detail?: string
  action?: ReactNode
}) {
  const tones = {
    critical: 'border-rose-200 bg-rose-50 text-rose-950',
    warn: 'border-amber-200 bg-amber-50 text-amber-950',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    info: 'border-slate-200 bg-white text-slate-900',
  } as const
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between', tones[tone])}>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {detail ? <p className="mt-0.5 text-[13px] opacity-80">{detail}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'warn' | 'ok' | 'critical'
}) {
  const border =
    tone === 'warn'
      ? 'border-amber-200'
      : tone === 'ok'
        ? 'border-emerald-200'
        : tone === 'critical'
          ? 'border-rose-200'
          : 'border-slate-200'
  return (
    <div className={cn('rounded-lg border bg-white px-4 py-3', border)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight text-brand-navy-900">{value}</div>
      {hint ? <p className="mt-1 text-[12px] text-slate-500">{hint}</p> : null}
    </div>
  )
}
