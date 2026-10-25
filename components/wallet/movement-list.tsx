import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'
import { cleanNoteText, parseMovementNote } from '@/lib/wallet/display'
import { formatMoney } from '@/lib/wallet/ledger'
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

export function MovementList({ rows, empty = 'Todavía no tenés movimientos.' }: { rows: Row[]; empty?: string }) {
  if (!rows.length) return <p className="p-6 text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y">
      {rows.map((m) => {
        const credit = isCredit(m.direction)
        const note = parseMovementNote(m.notes)
        const title = movementLabel(m.kind)
        const detail = cleanNoteText(title, note.text)
        return (
          <li key={m.id}>
          <Link href={`/dashboard/billetera/movimientos/${m.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/60 sm:px-6">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                note.pending ? 'bg-muted text-muted-foreground' : credit ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground',
              )}
              aria-hidden="true"
            >
              {credit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {formatDateTime(m.createdAt)}
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
  )
}
