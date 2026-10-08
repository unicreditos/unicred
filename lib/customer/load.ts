import { cache } from 'react'
import { and, desc, eq } from 'drizzle-orm'
import { getMyInstallments, getMyLoans } from '@/app/actions/loans'
import { db } from '@/lib/db'
import { kycVerification, loanContract, payment } from '@/lib/db/schema'
import { getOrCreateProfile, getSession, requireCustomer } from '@/lib/session'

/** Qué falta para poder pedir un crédito: se calcula igual en el resumen y en el perfil. */
export function profileProgress(p: {
  cuil?: string | null
  dni?: string | null
  phone?: string | null
  birthDate?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  monthlyIncome?: unknown
  employmentStatus?: string | null
} | null) {
  const steps = [
    { key: 'cuil', label: 'CUIL', done: Boolean(p?.cuil?.trim()) },
    { key: 'dni', label: 'DNI', done: Boolean(p?.dni?.trim()) },
    { key: 'phone', label: 'Teléfono', done: Boolean(p?.phone?.trim()) },
    { key: 'birthDate', label: 'Fecha de nacimiento', done: Boolean(p?.birthDate) },
    { key: 'province', label: 'Provincia', done: Boolean(p?.province?.trim()) },
    { key: 'city', label: 'Localidad', done: Boolean(p?.city?.trim()) },
    { key: 'address', label: 'Domicilio', done: Boolean(p?.address?.trim()) },
    { key: 'income', label: 'Ingresos', done: Number(p?.monthlyIncome ?? 0) > 0 },
    { key: 'employment', label: 'Situación laboral', done: Boolean(p?.employmentStatus?.trim()) },
  ]
  const done = steps.filter((s) => s.done).length
  return { steps, done, total: steps.length, pct: Math.round((done / steps.length) * 100) }
}

/**
 * Datos base del panel del cliente. Una sola carga por request: el layout y la
 * página comparten el resultado gracias a `cache`.
 */
export const loadCustomer = cache(async () => {
  const userId = await requireCustomer()
  const session = await getSession()
  const [profile, loans, installments, kycRows] = await Promise.all([
    getOrCreateProfile(),
    getMyLoans().catch(() => []),
    getMyInstallments().catch(() => []),
    db
      .select()
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .orderBy(desc(kycVerification.updatedAt))
      .limit(1)
      .catch(() => []),
  ])
  const kyc = kycRows[0] ?? null
  return {
    userId,
    user: {
      name: session?.user?.name || session?.user?.email?.split('@')[0] || 'Mi cuenta',
      email: session?.user?.email || '',
    },
    profile,
    loans,
    installments,
    kyc,
    identityVerified: kyc?.provider === 'didit' && kyc.status === 'approved',
  }
})

/** Domicilio en una línea, sin repetir localidad/provincia si ya vienen en la calle. */
export function oneLineAddress(p: { address?: string | null; city?: string | null; province?: string | null } | null) {
  const parts: string[] = []
  const base = (p?.address ?? '').trim()
  if (base) parts.push(base)
  for (const extra of [p?.city, p?.province]) {
    const e = (extra ?? '').trim()
    if (e && !parts.join(' ').toLowerCase().includes(e.toLowerCase())) parts.push(e)
  }
  return parts.join(', ')
}

export async function loadCustomerContracts(userId: string) {
  return db
    .select()
    .from(loanContract)
    .where(eq(loanContract.userId, userId))
    .orderBy(desc(loanContract.createdAt))
    .limit(50)
}

export async function loadCustomerPayments(userId: string) {
  return db
    .select()
    .from(payment)
    .where(and(eq(payment.userId, userId)))
    .orderBy(desc(payment.createdAt))
    .limit(50)
}
