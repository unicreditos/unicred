import { csvAmount, csvResponse, toCsv } from '@/lib/csv'
import { cleanNoteText, isPendingMovement, parseMovementNote } from '@/lib/wallet/display'
import { centsOf, ensureWallet, fromCents } from '@/lib/wallet/ledger'
import { MOVEMENT_GROUPS, balanceBefore, exportMovementsFiltered, isCredit, movementLabel, movementsBetween, parseDay } from '@/lib/wallet/queries'
import { getRoleForUser, getSession, isBanned } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function day(value: string | null, fallback: Date) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00-03:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return fallback
}

/** Extracto de la billetera en CSV (propio): saldo inicial, movimientos acreditados con saldo corrido y saldo final. */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user) return new Response('No autorizado', { status: 401 })
  if (await isBanned(session.user.id)) return new Response('Cuenta suspendida', { status: 403 })
  if ((await getRoleForUser(session.user.id)) === 'admin') return new Response('No disponible para cuentas de administración', { status: 403 })
  const url = new URL(req.url)
  const now = new Date()
  let desdeStr = parseDay(url.searchParams.get('desde')) ? url.searchParams.get('desde') : null
  let hastaStr = parseDay(url.searchParams.get('hasta')) ? url.searchParams.get('hasta') : null
  // Si el rango viene al revés se da vuelta (las fechas AAAA-MM-DD se ordenan como texto).
  if (desdeStr && hastaStr && desdeStr > hastaStr) [desdeStr, hastaStr] = [hastaStr, desdeStr]
  const from = day(desdeStr, new Date(now.getTime() - 30 * 86_400_000))
  const to = new Date(day(hastaStr, now).getTime() + 86_400_000)

  const wallet = await ensureWallet(session.user.id)

  // Con filtros de tipo, sentido o texto la lista es una selección: no tiene saldo corrido, y cierra con los totales de lo exportado.
  const group = MOVEMENT_GROUPS.some((g) => g.key === url.searchParams.get('grupo')) ? (url.searchParams.get('grupo') as string) : undefined
  const dirParam = url.searchParams.get('dir')
  const dir = dirParam === 'in' || dirParam === 'out' ? dirParam : undefined
  const q = (url.searchParams.get('q') ?? '').slice(0, 80)
  if (group || dir || q) {
    const selected = await exportMovementsFiltered(wallet.id, { group, dir, q, from: parseDay(desdeStr), to: parseDay(hastaStr) })
    let income = 0
    let expense = 0
    const lines: Array<Array<string | Date>> = []
    for (const r of selected) {
      if (isPendingMovement(r.notes)) continue
      const cents = centsOf(r.amount)
      const credit = isCredit(r.direction)
      if (credit) income += cents
      else expense += cents
      const title = movementLabel(r.kind)
      lines.push([r.createdAt, title, r.reference ?? '', cleanNoteText(title, parseMovementNote(r.notes).text) ?? '', (credit ? '' : '-') + csvAmount(r.amount)])
    }
    lines.push(['', 'Total de ingresos', '', '', csvAmount(fromCents(income))])
    lines.push(['', 'Total de egresos', '', '', '-' + csvAmount(fromCents(expense))])
    return csvResponse(`movimientos-${wallet.alias}.csv`, toCsv(['Fecha', 'Concepto', 'Referencia', 'Detalle', 'Importe'], lines))
  }

  const [rows, opening] = await Promise.all([movementsBetween(wallet.id, from, to), balanceBefore(wallet.id, from)])
  let running = opening
  const out: Array<Array<string | Date>> = [['', 'Saldo inicial', '', '', '', csvAmount(fromCents(opening))]]
  for (const r of rows) {
    if (isPendingMovement(r.notes)) continue
    const cents = centsOf(r.amount)
    running += isCredit(r.direction) ? cents : -cents
    out.push([r.createdAt, movementLabel(r.kind), r.reference ?? '', cleanNoteText(movementLabel(r.kind), parseMovementNote(r.notes).text) ?? '', (isCredit(r.direction) ? '' : '-') + csvAmount(r.amount), csvAmount(fromCents(running))])
  }
  out.push(['', 'Saldo final', '', '', '', csvAmount(fromCents(running))])
  const body = toCsv(['Fecha', 'Concepto', 'Referencia', 'Detalle', 'Importe', 'Saldo'], out)
  return csvResponse(`extracto-${wallet.alias}-${desdeStr ?? 'ultimos-30-dias'}.csv`, body)
}
