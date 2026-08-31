'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { adminClientHref, adminLoanHref, adminMerchantHref, type AdminTabId } from '@/lib/admin-nav'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Building2, CreditCard, Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'

type UserHit = {
  id: string
  name?: string | null
  email?: string | null
  cuil?: string | null
  dni?: string | null
  role?: string | null
}

type LoanHit = {
  id: string
  userId: string
  principal: string | number
  status: string
}

type MerchantHit = {
  id: string
  businessName: string
  cuit: string
  status: string
}

function maskDoc(value: string | null | undefined) {
  const d = String(value ?? '').replace(/\D/g, '')
  if (d.length < 8) return value || null
  return `${d.slice(0, 2)}-********-${d.slice(-1)}`
}

export function AdminCommandPalette({
  open,
  onOpenChange,
  users,
  loans,
  merchants,
  onNavigate: _onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserHit[]
  loans: LoanHit[]
  merchants: MerchantHit[]
  onNavigate: (tab: AdminTabId) => void
}) {
  const router = useRouter()
  const [q, setQ] = useState('')

  if (!open && q) setQ('')

  const term = q.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')

  const results = useMemo(() => {
    if (term.length < 2 && digits.length < 4) {
      return { users: [] as UserHit[], loans: [] as LoanHit[], merchants: [] as MerchantHit[] }
    }
    const usersHit = users
      .filter((u) => {
        const blob = `${u.name ?? ''} ${u.email ?? ''} ${u.cuil ?? ''} ${u.dni ?? ''}`.toLowerCase()
        if (term && blob.includes(term)) return true
        if (digits.length >= 4 && `${u.cuil ?? ''}${u.dni ?? ''}`.includes(digits)) return true
        return false
      })
      .slice(0, 6)
    const loansHit = loans
      .filter((l) => {
        if (term && l.id.toLowerCase().includes(term)) return true
        if (digits.length >= 4 && l.id.replace(/\D/g, '').includes(digits)) return true
        return false
      })
      .slice(0, 6)
    const merchantsHit = merchants
      .filter((m) => {
        const blob = `${m.businessName} ${m.cuit}`.toLowerCase()
        if (term && blob.includes(term)) return true
        if (digits.length >= 4 && m.cuit.replace(/\D/g, '').includes(digits)) return true
        return false
      })
      .slice(0, 6)
    return { users: usersHit, loans: loansHit, merchants: merchantsHit }
  }, [term, digits, users, loans, merchants])

  const empty = results.users.length + results.loans.length + results.merchants.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Búsqueda global</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, DNI, CUIL, crédito, comercio…"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="hidden rounded border bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">ESC</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {term.length < 2 && digits.length < 4 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Escribí al menos 2 caracteres.</p>
          ) : empty ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">No hay coincidencias en la cartera cargada.</p>
          ) : (
            <div className="space-y-3">
              {results.users.length > 0 ? (
                <Group label="Clientes" icon={Users}>
                  {results.users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={rowClass}
                      onClick={() => {
                        onOpenChange(false)
                        router.push(adminClientHref(u.id))
                      }}
                    >
                      <span className="truncate font-medium">{u.name || u.email || 'Sin nombre'}</span>
                      <span className="font-mono text-[11px] text-slate-500">{maskDoc(u.cuil || u.dni) ?? u.email}</span>
                    </button>
                  ))}
                </Group>
              ) : null}
              {results.loans.length > 0 ? (
                <Group label="Créditos" icon={CreditCard}>
                  {results.loans.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={rowClass}
                      onClick={() => {
                        onOpenChange(false)
                        router.push(adminLoanHref(l.id, l.status))
                      }}
                    >
                      <span className="font-mono text-xs">{l.id.slice(0, 8)}…</span>
                      <span className="text-xs text-slate-500">
                        {formatARS(l.principal)} · {l.status}
                      </span>
                    </button>
                  ))}
                </Group>
              ) : null}
              {results.merchants.length > 0 ? (
                <Group label="Comercios" icon={Building2}>
                  {results.merchants.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={rowClass}
                      onClick={() => {
                        onOpenChange(false)
                        router.push(adminMerchantHref(m.id))
                      }}
                    >
                      <span className="truncate font-medium">{m.businessName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{maskDoc(m.cuit)}</span>
                    </button>
                  ))}
                </Group>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const rowClass =
  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50'

function Group({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: typeof Users
  children: ReactNode
}) {
  return (
    <div>
      <p className={cn('flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400')}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
