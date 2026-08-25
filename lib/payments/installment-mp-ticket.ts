import { db } from '@/lib/db'
import { installment, loan, payment, profile, user as userTable } from '@/lib/db/schema'
import {
  createOfflineTicketPayment,
  extractMpTicketFields,
  mpApiFetch,
  type MpOfflineTicketNetwork,
} from '@/lib/mercadopago'
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm'

const TICKET_GRACE_DAYS = 20
const TICKET_MAX_DAYS = 30

export type InstallmentCashTicket = {
  network: MpOfflineTicketNetwork
  label: 'Pago Fácil' | 'Rapipago'
  barcode: string | null
  operationNumber: string | null
  ticketUrl: string | null
  paymentId: string
  expiresAt: string
}

export type InstallmentCashCoupons = {
  installmentId: string
  pagoFacil: InstallmentCashTicket | null
  rapipago: InstallmentCashTicket | null
}

function gatewayRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function gatewayString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function looksLikeOperationNumber(value: string | null) {
  return Boolean(value && /^\d{8,16}$/.test(value.replace(/\s+/g, '')))
}

function sameInstallment(row: { installmentId: string | null; gatewayResponse: unknown }, installmentId: string) {
  if (row.installmentId === installmentId) return true
  const ids = gatewayRecord(row.gatewayResponse).installment_ids
  return Array.isArray(ids) && ids.length === 1 && String(ids[0]) === installmentId
}

export function ticketValidUntil(dueDate: Date | string, now = new Date()) {
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  const withGrace = new Date(due.getTime() + TICKET_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const min = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const max = new Date(now.getTime() + TICKET_MAX_DAYS * 24 * 60 * 60 * 1000)
  const target = withGrace > min ? withGrace : min
  return target > max ? max : target
}

function ticketStillValid(row: { expiresAt?: Date | string | null; gatewayResponse?: unknown }) {
  const g = gatewayRecord(row.gatewayResponse)
  const hasData =
    (typeof g.barcode_content === 'string' && g.barcode_content.trim()) ||
    (typeof g.operation_number === 'string' && g.operation_number.trim()) ||
    (typeof g.payment_method_reference_id === 'string' && g.payment_method_reference_id.trim()) ||
    (typeof g.ticket_url === 'string' && g.ticket_url.trim())
  if (!hasData) return false
  const exp = row.expiresAt ? new Date(row.expiresAt) : null
  if (!exp || Number.isNaN(exp.getTime())) return false
  return exp.getTime() - Date.now() > 12 * 60 * 60 * 1000
}

function asCashTicket(
  network: MpOfflineTicketNetwork,
  parsed: {
    barcode: string | null
    operationNumber?: string | null
    ticketUrl: string | null
    paymentId: string
  },
  expiresAt: Date,
): InstallmentCashTicket {
  const barcode = parsed.barcode?.replace(/\s+/g, '') || null
  let operationNumber = parsed.operationNumber?.replace(/\s+/g, '') || null
  if (!operationNumber && barcode && /^\d{8,16}$/.test(barcode)) {
    operationNumber = barcode
  }
  return {
    network,
    label: network === 'pagofacil' ? 'Pago Fácil' : 'Rapipago',
    barcode,
    operationNumber,
    ticketUrl: parsed.ticketUrl,
    paymentId: parsed.paymentId,
    expiresAt: expiresAt.toISOString(),
  }
}

function methodFor(network: MpOfflineTicketNetwork) {
  return network === 'pagofacil' ? 'pago_facil' : 'rapipago'
}

async function hydrateTicketFromMercadoPago(parsed: {
  barcode: string | null
  operationNumber: string | null
  ticketUrl: string | null
  paymentId: string
}) {
  try {
    const fetched = await mpApiFetch(`/v1/payments/${encodeURIComponent(parsed.paymentId)}`)
    if (!fetched.ok) return parsed
    const fresh = extractMpTicketFields(fetched.data)
    if (!fresh) return parsed
    return {
      barcode: parsed.barcode || fresh.barcode,
      operationNumber: parsed.operationNumber || fresh.operationNumber,
      ticketUrl: parsed.ticketUrl || fresh.ticketUrl,
      paymentId: parsed.paymentId || fresh.paymentId,
    }
  } catch {
    return parsed
  }
}

async function ensureInstallmentNetworkTicket(opts: {
  userId: string
  loanId: string
  installmentId: string
  number: number
  amount: number
  dueDate: Date | string
  network: MpOfflineTicketNetwork
  payerEmail: string
  payerFirstName?: string
  payerLastName?: string
  identificationType?: string
  identificationNumber?: string
}): Promise<InstallmentCashTicket> {
  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, opts.userId),
        eq(payment.loanId, opts.loanId),
        eq(payment.gateway, 'mercado_pago'),
        eq(payment.method, methodFor(opts.network)),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date(Date.now() + 12 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(12)

  const reusable = existing.find((row) => sameInstallment(row, opts.installmentId) && ticketStillValid(row))
  if (reusable) {
    const g = gatewayRecord(reusable.gatewayResponse)
    const storedOp =
      gatewayString(g.operation_number) ||
      gatewayString(g.payment_method_reference_id) ||
      (looksLikeOperationNumber(gatewayString(reusable.referenceNumber))
        ? gatewayString(reusable.referenceNumber)
        : null)
    let parsed = {
      barcode: gatewayString(g.barcode_content),
      operationNumber: storedOp,
      ticketUrl: gatewayString(g.ticket_url) || reusable.paymentLinkUrl,
      paymentId: String(g.mp_payment_id ?? reusable.externalId ?? reusable.id),
    }
    if (
      (!parsed.operationNumber || !parsed.barcode || looksLikeOperationNumber(parsed.barcode)) &&
      parsed.paymentId
    ) {
      const before = parsed
      parsed = await hydrateTicketFromMercadoPago(parsed)
      if (
        parsed.operationNumber !== before.operationNumber ||
        parsed.barcode !== before.barcode ||
        parsed.ticketUrl !== before.ticketUrl
      ) {
        await db
          .update(payment)
          .set({
            gatewayResponse: {
              ...g,
              barcode_content: parsed.barcode,
              operation_number: parsed.operationNumber,
              ticket_url: parsed.ticketUrl,
              mp_payment_id: parsed.paymentId,
            },
            referenceNumber: parsed.operationNumber,
            updatedAt: new Date(),
          })
          .where(eq(payment.id, reusable.id))
      }
    }
    return asCashTicket(
      opts.network,
      parsed,
      reusable.expiresAt ? new Date(reusable.expiresAt) : ticketValidUntil(opts.dueDate),
    )
  }

  const id = crypto.randomUUID()
  const until = ticketValidUntil(opts.dueDate)
  const compact = opts.installmentId.replace(/[^A-Za-z0-9]/g, '').slice(0, 16)
  const [prior] = await db
    .select({ n: count() })
    .from(payment)
    .where(
      and(
        eq(payment.installmentId, opts.installmentId),
        eq(payment.method, methodFor(opts.network)),
        inArray(payment.status, ['cancelled', 'failed']),
      ),
    )
  const generation = Number(prior?.n ?? 0)
  const ticket = await createOfflineTicketPayment({
    amount: opts.amount,
    network: opts.network,
    description: `UNICRÉDITOS cuota #${opts.number} · ${opts.network === 'pagofacil' ? 'Pago Fácil' : 'Rapipago'}`,
    externalReference: `TK_${opts.network.slice(0, 2).toUpperCase()}_${compact}`.slice(0, 64),
    expiresAt: until,
    payerEmail: opts.payerEmail,
    payerFirstName: opts.payerFirstName,
    payerLastName: opts.payerLastName,
    identificationType: opts.identificationType,
    identificationNumber: opts.identificationNumber,
    metadata: {
      loan_id: opts.loanId,
      user_id: opts.userId,
      installment_ids: [opts.installmentId],
      kind: 'coupon_ticket',
      network: opts.network,
    },
    idempotencyKey: `ticket-${opts.network}-${opts.installmentId}-g${generation}`,
  })

  const expiresAt = ticket.expiresAt ? new Date(ticket.expiresAt) : until
  try {
    await db.insert(payment).values({
      id,
      userId: opts.userId,
      loanId: opts.loanId,
      installmentId: opts.installmentId,
      amount: String(opts.amount),
      currency: 'ARS',
      status: 'pending',
      method: methodFor(opts.network),
      source: 'coupon_book',
      gateway: 'mercado_pago',
      gatewayResponse: {
        kind: 'coupon_ticket',
        network: opts.network,
        barcode_content: ticket.barcode,
        operation_number: ticket.operationNumber,
        ticket_url: ticket.ticketUrl,
        mp_payment_id: ticket.paymentId,
        installment_ids: [opts.installmentId],
      },
      paymentLinkId: ticket.paymentId,
      paymentLinkUrl: ticket.ticketUrl,
      externalId: ticket.paymentId,
      referenceNumber: ticket.operationNumber || ticket.barcode,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
  } catch {
    const [dup] = await db
      .select()
      .from(payment)
      .where(eq(payment.externalId, ticket.paymentId))
      .limit(1)
    if (!dup) throw new Error('No se pudo guardar el cupón de red.')
  }

  return asCashTicket(opts.network, ticket, expiresAt)
}

export async function ensureLoanCouponTickets(loanId: string, ownerUserId: string) {
  const [loanRow] = await db
    .select({ id: loan.id, userId: loan.userId })
    .from(loan)
    .where(eq(loan.id, loanId))
    .limit(1)
  if (!loanRow || loanRow.userId !== ownerUserId) {
    throw new Error('Crédito no encontrado.')
  }

  const [payer] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, ownerUserId))
    .limit(1)
  const [prof] = await db
    .select({ dni: profile.dni, cuil: profile.cuil })
    .from(profile)
    .where(eq(profile.userId, ownerUserId))
    .limit(1)

  if (!payer?.email) {
    throw new Error('El titular no tiene email. No se pueden emitir cupones de Pago Fácil / Rapipago.')
  }

  const rows = await db.select().from(installment).where(eq(installment.loanId, loanId))
  const open = rows
    .filter((row) => row.status !== 'paid' && row.status !== 'cancelled')
    .sort((a, b) => a.number - b.number)
  const payerFirst = payer.name?.split(' ')[0]
  const payerLast = payer.name?.split(' ').slice(1).join(' ') || undefined
  const identificationNumber = (prof?.dni || prof?.cuil || '').replace(/\D/g, '') || undefined
  const identificationType = identificationNumber
    ? identificationNumber.length === 11
      ? 'CUIT'
      : 'DNI'
    : undefined

  const out: Record<string, InstallmentCashCoupons> = {}
  const chunkSize = 3
  for (let i = 0; i < open.length; i += chunkSize) {
    const chunk = open.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (row) => {
        const base = {
          userId: ownerUserId,
          loanId,
          installmentId: row.id,
          number: row.number,
          amount: Number(row.amount) || 0,
          dueDate: row.dueDate,
          payerEmail: payer.email,
          payerFirstName: payerFirst,
          payerLastName: payerLast,
          identificationType,
          identificationNumber,
        }
        const [pagoFacil, rapipago] = await Promise.all([
          ensureInstallmentNetworkTicket({ ...base, network: 'pagofacil' }).catch((err) => {
            console.error('[mp-ticket] pagofacil', row.id, (err as Error).message)
            return null
          }),
          ensureInstallmentNetworkTicket({ ...base, network: 'rapipago' }).catch((err) => {
            console.error('[mp-ticket] rapipago', row.id, (err as Error).message)
            return null
          }),
        ])
        out[row.id] = { installmentId: row.id, pagoFacil, rapipago }
      }),
    )
  }
  return out
}
