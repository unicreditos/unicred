/** Avisos por mail de la venta financiada en comercios. Nunca cortan el flujo de negocio. */
import { db } from '@/lib/db'
import { merchant, user as userTable } from '@/lib/db/schema'
import { emailOrigin, noticeEmail, sendEmail } from '@/lib/email'
import { formatARS } from '@/lib/finance'
import { isMerchantOrderLoan } from '@/lib/merchant-orders/detect'
import { formatPayDate } from '@/lib/merchant-orders/rules'
import { getOrder, loadOrders, type OrderView } from '@/lib/merchant-orders/service'
import { eq } from 'drizzle-orm'

async function mailOf(userId: string) {
  const [row] = await db.select({ email: userTable.email, name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  return row?.email ? row : null
}

async function merchantMail(merchantId: string) {
  const [m] = await db.select({ userId: merchant.userId }).from(merchant).where(eq(merchant.id, merchantId)).limit(1)
  return m ? mailOf(m.userId) : null
}

async function send(to: { email: string; name: string | null } | null, msg: Omit<Parameters<typeof noticeEmail>[0], 'to' | 'name'>) {
  if (!to) return
  try {
    const r = await sendEmail(noticeEmail({ ...msg, to: to.email, name: to.name }))
    if (!r.ok) console.error('[merchant-orders/notify] no entregado:', msg.subject, r.error)
  } catch (err) {
    console.error('[merchant-orders/notify]', err instanceof Error ? err.message : err)
  }
}

const itemsLine = (o: OrderView) => o.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(', ')

export async function notifyOrderCreated(orderId: string) {
  const o = await getOrder(orderId)
  if (!o) return
  await send(await mailOf(o.customerUserId), {
    subject: `Tu compra en ${o.merchantName} está en revisión`,
    title: 'Compra en cuotas en revisión',
    lines: [
      `${o.merchantName} cargó tu compra (${o.code}): ${itemsLine(o)}.`,
      `Precio: ${formatARS(o.totalAmount)}. Anticipo del 30%: ${formatARS(o.downPaymentAmount)}. Financiado: ${formatARS(o.financedAmount)} en ${o.term} cuotas de ${formatARS(o.installmentAmount)}.`,
      'Una persona de la mesa de créditos revisa la operación. Si la aprueba, vas a firmar desde tu cuenta y pagar el anticipo por QR o transferencia a UNICRÉDITOS. No le pagues el anticipo al comercio.',
    ],
    cta: { href: `${emailOrigin()}/dashboard/creditos`, label: 'Ver mi compra' },
  })
}

/** Llamado desde la mesa (aprobar / rechazar). No hace nada si el crédito no es de una venta en comercio. */
export async function notifyOrderDecision(loanId: string, decision: 'approved' | 'rejected') {
  try {
    if (!(await isMerchantOrderLoan(db, loanId))) return
    const [o] = await loadOrders({ loanId, limit: 1 })
    if (!o) return
    const customer = await mailOf(o.customerUserId)
    const shop = await merchantMail(o.merchantId)
    if (decision === 'approved') {
      await send(customer, {
        subject: `Aprobamos tu compra en ${o.merchantName}`,
        title: 'Compra aprobada: dos pasos para retirarla',
        lines: [
          `La mesa aprobó tu compra ${o.code} (${itemsLine(o)}).`,
          `1) Firmá el contrato y el pagaré desde tu cuenta. 2) Pagá el anticipo de ${formatARS(o.downPaymentAmount)} con el QR de Mercado Pago o por transferencia a la cuenta de UNICRÉDITOS.`,
          'Cuando el anticipo se acredita, en tu cuenta aparece un código de entrega de 6 dígitos: dáselo al comercio al retirar el producto.',
        ],
        cta: { href: `${emailOrigin()}/dashboard/creditos`, label: 'Firmar y pagar el anticipo' },
      })
      await send(shop, {
        subject: `Operación ${o.code} aprobada`,
        title: 'Operación aprobada por la mesa',
        lines: [
          `Aprobamos la venta ${o.code} a ${o.customerName ?? 'tu cliente'} por ${formatARS(o.totalAmount)}.`,
          'Todavía no entregues el producto: el cliente tiene que firmar y pagar el anticipo a UNICRÉDITOS. Te avisamos cuando esté lista para entregar.',
        ],
        cta: { href: `${emailOrigin()}/merchant?tab=operaciones`, label: 'Ver la operación' },
      })
    } else {
      await send(shop, {
        subject: `Operación ${o.code} no aprobada`,
        title: 'Operación no aprobada',
        lines: [`La mesa de créditos no aprobó la venta ${o.code}. No entregues el producto financiado.`, o.rejectionReason ? `Motivo: ${o.rejectionReason}` : ''].filter(Boolean),
        cta: { href: `${emailOrigin()}/merchant?tab=operaciones`, label: 'Ver la operación' },
      })
    }
  } catch (err) {
    console.error('[merchant-orders/notify] decisión', err instanceof Error ? err.message : err)
  }
}

export async function notifyDownPaymentConfirmed(orderId: string) {
  const o = await getOrder(orderId)
  if (!o) return
  await send(await mailOf(o.customerUserId), {
    subject: 'Recibimos tu anticipo',
    title: 'Anticipo acreditado',
    lines: [
      `Acreditamos el anticipo de ${formatARS(o.downPaymentAmount)} de tu compra ${o.code}.`,
      o.contractSigned
        ? `Ya podés retirar tu compra en ${o.merchantName}. Tu código de entrega está en tu cuenta: dáselo al comercio solo cuando tengas el producto.`
        : 'Falta que firmes el contrato desde tu cuenta para poder retirar el producto.',
    ],
    cta: { href: `${emailOrigin()}/dashboard/creditos`, label: 'Ver mi código de entrega' },
  })
  if (o.stage === 'lista_para_entregar') {
    await send(await merchantMail(o.merchantId), {
      subject: `Operación ${o.code} lista para entregar`,
      title: 'Ya podés entregar el producto',
      lines: [
        `${o.customerName ?? 'El cliente'} firmó y pagó el anticipo de la operación ${o.code}.`,
        'Al entregar, pedile su código de 6 dígitos y cargalo en Operaciones. Con eso la venta entra en la liquidación del viernes.',
      ],
      cta: { href: `${emailOrigin()}/merchant?tab=operaciones`, label: 'Confirmar entrega' },
    })
  }
}

export async function notifyDownPaymentRejected(orderId: string, note: string) {
  const o = await getOrder(orderId)
  if (!o) return
  await send(await mailOf(o.customerUserId), {
    subject: 'No pudimos acreditar tu anticipo',
    title: 'Anticipo no acreditado',
    lines: [`Revisamos el comprobante del anticipo de tu compra ${o.code} y no pudimos acreditarlo.`, `Motivo: ${note}`, 'Podés volver a informarlo o pagarlo con el QR desde tu cuenta.'],
    cta: { href: `${emailOrigin()}/dashboard/creditos`, label: 'Pagar el anticipo' },
  })
}

export async function notifyDelivered(orderId: string) {
  const o = await getOrder(orderId)
  if (!o) return
  await send(await mailOf(o.customerUserId), {
    subject: `Retiraste tu compra en ${o.merchantName}`,
    title: 'Compra entregada: tu crédito está vigente',
    lines: [
      `${o.merchantName} confirmó la entrega de ${itemsLine(o)}.`,
      `Tu crédito por ${formatARS(o.financedAmount)} quedó vigente: ${o.term} cuotas de ${formatARS(o.installmentAmount)}. La primera vence en un mes.`,
    ],
    cta: { href: `${emailOrigin()}/dashboard/pagos`, label: 'Ver mis cuotas' },
  })
  if (o.settlementPayDate) {
    await send(await merchantMail(o.merchantId), {
      subject: `Entrega ${o.code} registrada`,
      title: 'Entrega registrada',
      lines: [`Registramos la entrega de la operación ${o.code}.`, `Te liquidamos ${formatARS(o.netAmount)} el ${formatPayDate(o.settlementPayDate)}.`],
      cta: { href: `${emailOrigin()}/merchant?tab=liquidaciones`, label: 'Ver liquidaciones' },
    })
  }
}

export async function notifySettlementPaid(input: { merchantId: string; code: string; netAmount: string | number; transferReference: string }) {
  await send(await merchantMail(input.merchantId), {
    subject: `Liquidación ${input.code} transferida`,
    title: 'Te transferimos la liquidación',
    lines: [`Transferimos ${formatARS(input.netAmount)} a tu cuenta de cobro (liquidación ${input.code}).`, `Número de operación: ${input.transferReference}.`],
    cta: { href: `${emailOrigin()}/merchant?tab=liquidaciones`, label: 'Ver el detalle' },
  })
}
