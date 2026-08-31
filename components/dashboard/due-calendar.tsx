'use client'

import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'

type Due = {
  id: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function DueCalendar({ installments }: { installments: Due[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const months: { key: string; label: string; start: Date }[] = []
  for (let i = 0; i < 6; i++) {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 1)
    months.push({
      key: monthKey(start),
      label: start.toLocaleDateString('es-AR', { month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }),
      start,
    })
  }

  const open = installments.filter((row) => row.status !== 'paid' && row.status !== 'cancelled')
  const byMonth = new Map<string, Due[]>()
  for (const row of open) {
    const d = new Date(row.dueDate)
    const key = monthKey(d)
    const list = byMonth.get(key) ?? []
    list.push(row)
    byMonth.set(key, list)
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy-900">Calendario de vencimientos</h2>
        <p className="text-xs text-muted-foreground">Próximos 6 meses · cuotas abiertas</p>
      </header>
      <div className="grid gap-px bg-muted sm:grid-cols-3 lg:grid-cols-6">
        {months.map((m) => {
          const rows = byMonth.get(m.key) ?? []
          const overdue = rows.some((r) => {
            const d = new Date(r.dueDate)
            d.setHours(0, 0, 0, 0)
            return d < today || r.status === 'overdue'
          })
          const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
          return (
            <div key={m.key} className="bg-card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
              {rows.length ? (
                <>
                  <p className={cn('mt-1 font-mono text-sm font-semibold', overdue ? 'text-rose-700' : 'text-brand-navy-900')}>
                    {formatARS(total)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {rows.length === 1 ? '1 cuota' : `${rows.length} cuotas`}
                    {overdue ? ' · con atraso' : ''}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Sin vencimientos</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
