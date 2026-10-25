import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { WalletStatementPrintable, type StatementData } from '@/components/documents/wallet-statement-printable'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { db } from '@/lib/db'
import { profile, walletAccount } from '@/lib/db/schema'
import { documentPdfBaseName } from '@/lib/document-filename'
import { hasPermission } from '@/lib/rbac'
import { getRoleForUser, requireUserId } from '@/lib/session'
import { isPendingMovement } from '@/lib/wallet/display'
import { centsOf, ensureWallet, fromCents } from '@/lib/wallet/ledger'
import { balanceBefore, isCredit, movementsBetween } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Resumen de cuenta' }
export const dynamic = 'force-dynamic'

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

function parseDay(value: string | undefined, fallback: Date) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00-03:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return fallback
}

const dayInput = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)

export default async function WalletStatementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewerId = await requireUserId()
  const params = await searchParams

  // Un administrador con permiso de finanzas puede abrir el resumen de otra persona (?usuario=<id>).
  let ownerId = viewerId
  const requested = one(params.usuario)
  if (requested && requested !== viewerId) {
    const isAdmin = (await getRoleForUser(viewerId)) === 'admin'
    if (!isAdmin || !(await hasPermission(viewerId, 'finance.read'))) ownerId = viewerId
    else ownerId = requested
  }

  // Los valores por defecto se anclan a la medianoche de hoy (hora AR): si no, "hasta" caía en mañana.
  const today = parseDay(dayInput(new Date()), new Date())
  const defaultFrom = new Date(today.getTime() - 30 * 86_400_000)
  const day1 = parseDay(one(params.desde), defaultFrom)
  const day2 = parseDay(one(params.hasta), today)
  // Si el rango viene al revés, se da vuelta en vez de mostrar un resumen vacío.
  const [from, toDay] = day1 <= day2 ? [day1, day2] : [day2, day1]
  const to = new Date(toDay.getTime() + 86_400_000) // el día "hasta" entra completo

  const wallet = ownerId === viewerId ? await ensureWallet(ownerId) : (await db.select().from(walletAccount).where(eq(walletAccount.userId, ownerId)).limit(1))[0]
  if (!wallet) {
    return (
      <main id="contenido" className="p-8 text-center text-sm text-muted-foreground">
        Esa persona no tiene billetera.
      </main>
    )
  }
  const [rows, opening, [prof]] = await Promise.all([
    movementsBetween(wallet.id, from, to),
    balanceBefore(wallet.id, from),
    db.select({ cuil: profile.cuil }).from(profile).where(eq(profile.userId, ownerId)).limit(1),
  ])
  // Solo cuenta lo acreditado: el saldo corrido se calcula acá, así el resumen siempre cierra (inicial + ingresos − egresos = final).
  let credits = 0
  let debits = 0
  let pendingCount = 0
  let pendingCents = 0
  let running = opening
  const posted: StatementData['rows'] = []
  for (const r of rows) {
    if (isPendingMovement(r.notes)) {
      pendingCount += 1
      pendingCents += centsOf(r.amount)
      continue
    }
    const cents = centsOf(r.amount)
    if (isCredit(r.direction)) {
      credits += cents
      running += cents
    } else {
      debits += cents
      running -= cents
    }
    posted.push({ id: r.id, createdAt: r.createdAt, kind: r.kind, direction: r.direction, amount: r.amount, balance: fromCents(running), reference: r.reference, notes: r.notes })
  }
  const closing = running

  const data: StatementData = {
    number: `RES-${wallet.id.slice(0, 6).toUpperCase()}-${dayInput(from).replace(/-/g, '')}`,
    holder: wallet.holderName ?? '—',
    cuil: prof?.cuil ?? wallet.taxId,
    alias: wallet.alias,
    cvu: wallet.cvu,
    from,
    to,
    openingBalance: fromCents(opening),
    closingBalance: fromCents(closing),
    credits: fromCents(credits),
    debits: fromCents(debits),
    rows: posted,
    pendingCount,
    pendingAmount: fromCents(pendingCents),
    currentBalance: wallet.balance,
    truncated: rows.length >= 2000,
  }

  const embed = one(params.embed) === '1'
  return (
    <DocumentPreviewShell
      backHref={ownerId === viewerId ? '/dashboard/billetera' : `/admin/billeteras/${ownerId}`}
      meta={`Resumen de cuenta · ${dayInput(from)} al ${dayInput(toDay)}`}
      fileName={documentPdfBaseName('Resumen-billetera', data.number)}
      extra={
        embed ? null : (
          <form action="/dashboard/billetera/resumen" className="no-print flex flex-wrap items-center gap-2 text-xs">
            {ownerId !== viewerId ? <input type="hidden" name="usuario" value={ownerId} /> : null}
            <label className="flex items-center gap-1">
              Desde <Input type="date" name="desde" defaultValue={dayInput(from)} className="h-8 w-36 text-xs" />
            </label>
            <label className="flex items-center gap-1">
              Hasta <Input type="date" name="hasta" defaultValue={dayInput(toDay)} className="h-8 w-36 text-xs" />
            </label>
            <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Ver
            </button>
          </form>
        )
      }
    >
      <WalletStatementPrintable data={data} />
    </DocumentPreviewShell>
  )
}

