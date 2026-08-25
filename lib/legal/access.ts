import { adminUrl } from '@/lib/admin-nav'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import { getRoleForUser, type Role } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function canViewOwnedRecord(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true
  return (await getRoleForUser(viewerId)) === 'admin'
}

export async function documentBackHref(viewerId: string, ownerId?: string): Promise<string> {
  const role = await getRoleForUser(viewerId)
  return documentBackHrefForRole(role, ownerId)
}

export function documentBackHrefForRole(role: Role, ownerId?: string): string {
  if (role === 'admin') return ownerId ? adminUrl('usuarios', ownerId) : '/admin?tab=usuarios'
  return '/dashboard?tab=documentos'
}

export function receiptBackHrefForRole(role: Role, ownerId?: string): string {
  if (role === 'admin') return ownerId ? adminUrl('usuarios', ownerId) : '/admin?tab=usuarios'
  return '/dashboard?tab=comprobantes'
}

export async function documentBackHrefForLoan(viewerId: string, loanId: string) {
  const role = await getRoleForUser(viewerId)
  if (role !== 'admin') return documentBackHrefForRole(role)
  const [row] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, loanId)).limit(1)
  return documentBackHrefForRole(role, row?.userId)
}
