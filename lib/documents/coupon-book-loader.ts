import 'server-only'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import {
  asNetworkCode,
  barcodesAvailableFrom,
  isOpenInstallment,
  qrSvgFromPayload,
  resolveCouponBook,
  type CashTicket,
  type CouponBookPay,
  type CouponTalonPay,
} from '@/lib/documents/coupon-payment-data'
import type { InstallmentDoc } from '@/lib/legal/types'
import { couponPayUrl } from '@/lib/payments/coupon-link'
import { ensureLoanCouponTickets } from '@/lib/payments/installment-mp-ticket'
import { eq } from 'drizzle-orm'

/**
 * Arma el QR de cada cuota y pide a Mercado Pago los códigos de las que están en ventana.
 * Quien llama ya validó que el visitante puede ver el crédito.
 */
export async function loadCouponBookPay(input: {
  loanId: string
  installments: InstallmentDoc[]
  now?: Date
}): Promise<CouponBookPay> {
  const now = input.now ?? new Date()
  const [owner] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, input.loanId)).limit(1)
  if (!owner) return resolveCouponBook([], ['Crédito no encontrado.'])
  const open = input.installments.filter((row) => row.id && isOpenInstallment(row.status))
  const inWindow = new Set(open.filter((row) => !barcodesAvailableFrom(row.dueDate, now)).map((row) => row.id as string))

  const extra: string[] = []
  let tickets: Record<string, { pagoFacil: CashTicket; rapipago: CashTicket }> = {}
  if (inWindow.size) {
    try {
      tickets = await ensureLoanCouponTickets(input.loanId, owner.userId, { onlyInstallmentIds: inWindow })
    } catch (err) {
      extra.push(`Mercado Pago no emitió los códigos de Pago Fácil y Rapipago: ${(err as Error).message}`)
    }
  }

  const talons: CouponTalonPay[] = []
  for (const row of open) {
    const id = row.id as string
    const qrUrl = couponPayUrl(id)
    const from = barcodesAvailableFrom(row.dueDate, now)
    talons.push({
      installmentId: id,
      number: row.number,
      qrUrl,
      qrSvg: await qrSvgFromPayload(qrUrl),
      barcodesFrom: from ? from.toISOString() : null,
      pagoFacil: from ? null : asNetworkCode('pagofacil', tickets[id]?.pagoFacil ?? null),
      rapipago: from ? null : asNetworkCode('rapipago', tickets[id]?.rapipago ?? null),
    })
  }
  return resolveCouponBook(talons, extra)
}
