import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Coins,
  Landmark,
  QrCode,
  Receipt,
  SlidersHorizontal,
  Undo2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cleanNoteText, parseMovementNote } from '@/lib/wallet/display'
import { formatMoney } from '@/lib/money'
import { isCredit, movementLabel } from '@/lib/wallet/queries'
import { cn } from '@/lib/utils'

type Row = {
  id: string
  direction: string
  kind: string
  amount: string
  balanceAfter: string
  reference: string | null
  notes: string | null
  createdAt: Date
}

const ICONS: Record<string, LucideIcon> = {
  mp_qr_in: QrCode,
  mp_qr_reversal: Undo2,
  payout_refund: Undo2,
  treasury_payout: Landmark,
  outbound_transfer: Landmark,
  pay_installment: Receipt,
  loan_disbursement: Coins,
  loan_withdrawal: Undo2,
  service_payment: Zap,
  service_bill: Zap,
  service_recharge: Zap,
  admin_adjustment: SlidersHorizontal,
  load: Banknote,
}

const TZ = 'America/Argentina/Buenos_Aires'
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const timeFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })

function dayLabel(d: Date, now: Date) {
  const key = dayKey(d)
  if (key === dayKey(now)) return 'Hoy'
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return 'Ayer'
  return dayFmt.format(d)
}

/** Actividad de la cuenta agrupada por día, con un ícono por tipo de operación y el importe con signo. */
export function ActivityFeed({ rows, empty = 'Todavía no tenés movimientos.' }: { rows: Row[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  const now = new Date()
  const groups: Array<{ label: string; rows: Row[] }> = []
  for (const r of rows) {
    const created = new Date(r.createdAt)
    const label = dayLabel(created, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground first-letter:uppercase">{g.label}</h3>
          <ul className="divide-y">
            {g.rows.map((m) => {
              const credit = isCredit(m.direction)
              const note = parseMovementNote(m.notes)
              const Icon = ICONS[m.kind] ?? (credit ? ArrowDownLeft : ArrowUpRight)
              const title = movementLabel(m.kind)
              const detail = cleanNoteText(title, note.text)
              return (
                <li key={m.id}>
                  <Link href={`/dashboard/billetera/movimientos/${m.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      note.pending ? 'bg-muted text-muted-foreground' : credit ? 'bg-success/12 text-success' : 'bg-muted text-foreground/70',
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {timeFmt.format(new Date(m.createdAt))}
                      {detail ? ` · ${detail}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {note.pending ? (
                      <p className="tnum text-sm font-semibold text-muted-foreground">
                        {formatMoney(m.amount)} <span className="text-xs font-medium">pendiente</span>
                      </p>
                    ) : (
                      <>
                        <p className={cn('tnum text-sm font-semibold', credit ? 'text-success' : 'text-foreground')}>
                          {credit ? '+' : '−'} {formatMoney(m.amount)}
                        </p>
                        <p className="tnum text-xs text-muted-foreground">Saldo {formatMoney(m.balanceAfter)}</p>
                      </>
                    )}
                  </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
