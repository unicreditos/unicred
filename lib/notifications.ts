import { db } from '@/lib/db'
import {
  disbursement,
  installment,
  kycVerification,
  loan,
  merchant,
  payment,
  user as userTable,
} from '@/lib/db/schema'
import { formatARS } from '@/lib/finance'
import type { Role } from '@/lib/session'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'

export type InboxTone = 'info' | 'ok' | 'warn' | 'critical'

export type InboxItem = {
  id: string
  title: string
  detail: string
  at: string
  href: string
  tone: InboxTone
}

export type InboxPayload = {
  items: InboxItem[]
  stamp: string
  unreadHint: number
}

function iso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString()
  return new Date(value).toISOString()
}

function sortItems(items: InboxItem[]) {
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 20)
}

async function customerInbox(userId: string): Promise<InboxItem[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const week = new Date(today)
  week.setDate(week.getDate() + 7)

  const [dues, pays, loans, kycs, disbs] = await Promise.all([
    db
      .select({
        id: installment.id,
        number: installment.number,
        amount: installment.amount,
        dueDate: installment.dueDate,
        status: installment.status,
      })
      .from(installment)
      .where(and(eq(installment.userId, userId), inArray(installment.status, ['pending', 'overdue'])))
      .orderBy(installment.dueDate)
      .limit(8),
    db
      .select({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(eq(payment.userId, userId))
      .orderBy(desc(payment.createdAt))
      .limit(6),
    db
      .select({
        id: loan.id,
        status: loan.status,
        principal: loan.principal,
        updatedAt: loan.updatedAt,
      })
      .from(loan)
      .where(eq(loan.userId, userId))
      .orderBy(desc(loan.updatedAt))
      .limit(6),
    db
      .select({
        id: kycVerification.id,
        status: kycVerification.status,
        updatedAt: kycVerification.updatedAt,
      })
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .limit(1),
    db
      .select({
        id: disbursement.id,
        amount: disbursement.amount,
        status: disbursement.status,
        updatedAt: disbursement.updatedAt,
      })
      .from(disbursement)
      .where(eq(disbursement.userId, userId))
      .orderBy(desc(disbursement.updatedAt))
      .limit(4),
  ])

  const items: InboxItem[] = []

  for (const row of dues) {
    const due = new Date(row.dueDate)
    const overdue = due < today || row.status === 'overdue'
    items.push({
      id: `inst-${row.id}`,
      title: overdue ? `Cuota #${row.number} vencida` : `Cuota #${row.number} próxima`,
      detail: `${formatARS(row.amount)} · vence ${due.toLocaleDateString('es-AR')}`,
      at: iso(row.dueDate),
      href: '/dashboard?tab=pagos',
      tone: overdue ? 'critical' : due <= week ? 'warn' : 'info',
    })
  }

  for (const row of pays) {
    if (row.status !== 'paid') continue
    items.push({
      id: `pay-${row.id}`,
      title: 'Pago acreditado',
      detail: formatARS(row.amount),
      at: iso(row.paidAt ?? row.createdAt),
      href: '/dashboard?tab=comprobantes',
      tone: 'ok',
    })
  }

  for (const row of loans) {
    if (row.status === 'approved' || row.status === 'active') {
      items.push({
        id: `loan-ok-${row.id}`,
        title: 'Crédito aprobado',
        detail: formatARS(row.principal),
        at: iso(row.updatedAt),
        href: '/dashboard?tab=cuotas',
        tone: 'ok',
      })
    } else if (row.status === 'rejected') {
      items.push({
        id: `loan-no-${row.id}`,
        title: 'Solicitud no aprobada',
        detail: 'Podés volver a solicitar cuando tu perfil cambie.',
        at: iso(row.updatedAt),
        href: '/dashboard?tab=mis_solicitudes',
        tone: 'warn',
      })
    }
  }

  const kyc = kycs[0]
  if (kyc) {
    items.push({
      id: `kyc-${kyc.id}`,
      title:
        kyc.status === 'approved' || kyc.status === 'verified'
          ? 'Identidad verificada'
          : kyc.status === 'rejected'
            ? 'Identidad observada'
            : 'Identidad en revisión',
      detail: 'Didit es el único canal de KYC.',
      at: iso(kyc.updatedAt),
      href: '/dashboard?tab=kyc_biometrico',
      tone: kyc.status === 'rejected' ? 'warn' : 'info',
    })
  }

  for (const row of disbs) {
    if (row.status !== 'credited') continue
    items.push({
      id: `dis-${row.id}`,
      title: 'Desembolso acreditado',
      detail: formatARS(row.amount),
      at: iso(row.updatedAt),
      href: '/dashboard?tab=comprobantes',
      tone: 'ok',
    })
  }

  return sortItems(items)
}

async function merchantInbox(userId: string): Promise<InboxItem[]> {
  const [shop] = await db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1)
  if (!shop) {
    return [
      {
        id: 'merchant-none',
        title: 'Completá la adhesión',
        detail: 'Sin comercio habilitado no se originan ventas.',
        at: new Date().toISOString(),
        href: '/merchant?tab=profile',
        tone: 'info',
      },
    ]
  }

  const sales = await db
    .select({
      id: loan.id,
      status: loan.status,
      principal: loan.principal,
      updatedAt: loan.updatedAt,
    })
    .from(loan)
    .where(eq(loan.merchantId, shop.id))
    .orderBy(desc(loan.updatedAt))
    .limit(10)

  return sortItems(
    sales.map((row) => ({
      id: `sale-${row.id}`,
      title:
        row.status === 'rejected'
          ? 'Venta no financiada'
          : row.status === 'pending'
            ? 'Venta en evaluación'
            : 'Venta con crédito',
      detail: formatARS(row.principal),
      at: iso(row.updatedAt),
      href: '/merchant?tab=solicitudes_recibidas',
      tone: row.status === 'rejected' ? 'warn' : row.status === 'pending' ? 'info' : 'ok',
    })),
  )
}

async function adminInbox(): Promise<InboxItem[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [pendingLoans, pendingKyc, pendingMerchants, pendingDisb, overdue] = await Promise.all([
    db
      .select({
        id: loan.id,
        principal: loan.principal,
        createdAt: loan.createdAt,
        userId: loan.userId,
      })
      .from(loan)
      .where(eq(loan.status, 'pending'))
      .orderBy(desc(loan.createdAt))
      .limit(8),
    db
      .select({
        id: kycVerification.id,
        userId: kycVerification.userId,
        status: kycVerification.status,
        updatedAt: kycVerification.updatedAt,
      })
      .from(kycVerification)
      .where(inArray(kycVerification.status, ['pending', 'pending_review', 'reviewing']))
      .orderBy(desc(kycVerification.updatedAt))
      .limit(8),
    db
      .select({
        id: merchant.id,
        businessName: merchant.businessName,
        createdAt: merchant.createdAt,
      })
      .from(merchant)
      .where(eq(merchant.status, 'pending'))
      .orderBy(desc(merchant.createdAt))
      .limit(6),
    db
      .select({
        id: disbursement.id,
        amount: disbursement.amount,
        updatedAt: disbursement.updatedAt,
      })
      .from(disbursement)
      .where(inArray(disbursement.status, ['pending', 'processing']))
      .orderBy(desc(disbursement.updatedAt))
      .limit(6),
    db
      .select({
        id: installment.id,
        number: installment.number,
        amount: installment.amount,
        dueDate: installment.dueDate,
      })
      .from(installment)
      .where(and(eq(installment.status, 'pending'), lt(installment.dueDate, today)))
      .orderBy(installment.dueDate)
      .limit(6),
  ])

  const userIds = [...new Set([...pendingLoans.map((l) => l.userId), ...pendingKyc.map((k) => k.userId)])]
  const names = userIds.length
    ? await db
        .select({ id: userTable.id, name: userTable.name })
        .from(userTable)
        .where(inArray(userTable.id, userIds))
    : []
  const nameById = new Map(names.map((u) => [u.id, u.name || 'Cliente']))

  const items: InboxItem[] = []

  for (const row of pendingLoans) {
    items.push({
      id: `adm-loan-${row.id}`,
      title: 'Solicitud a decidir',
      detail: `${nameById.get(row.userId) ?? 'Cliente'} · ${formatARS(row.principal)}`,
      at: iso(row.createdAt),
      href: '/admin?tab=creditos',
      tone: 'warn',
    })
  }
  for (const row of pendingKyc) {
    items.push({
      id: `adm-kyc-${row.id}`,
      title: 'KYC pendiente',
      detail: nameById.get(row.userId) ?? 'Cliente',
      at: iso(row.updatedAt),
      href: '/admin?tab=kyc',
      tone: 'warn',
    })
  }
  for (const row of pendingMerchants) {
    items.push({
      id: `adm-mer-${row.id}`,
      title: 'Comercio en adhesión',
      detail: row.businessName,
      at: iso(row.createdAt),
      href: '/admin?tab=comercios',
      tone: 'info',
    })
  }
  for (const row of pendingDisb) {
    items.push({
      id: `adm-dis-${row.id}`,
      title: 'Desembolso pendiente',
      detail: formatARS(row.amount),
      at: iso(row.updatedAt),
      href: '/admin?tab=desembolsos',
      tone: 'warn',
    })
  }
  for (const row of overdue) {
    items.push({
      id: `adm-over-${row.id}`,
      title: `Cuota #${row.number} vencida`,
      detail: formatARS(row.amount),
      at: iso(row.dueDate),
      href: '/admin?tab=cartera_activa',
      tone: 'critical',
    })
  }

  return sortItems(items)
}

export async function getInbox(userId: string, role: Role): Promise<InboxPayload> {
  const items =
    role === 'admin' ? await adminInbox() : role === 'merchant' ? await merchantInbox(userId) : await customerInbox(userId)
  const stamp = items[0]?.at ?? new Date(0).toISOString()
  return { items, stamp, unreadHint: items.length }
}

