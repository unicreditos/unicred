import 'server-only'

import { customerDashboardDocUrl, type CustomerDocKind } from '@/lib/documents/customer-view'
import { getRoleForUser, requireUserId } from '@/lib/session'
import { redirect } from 'next/navigation'

export async function keepCustomerInDashboard(
  kind: CustomerDocKind,
  id: string,
  searchParams?: Promise<{ embed?: string | string[]; print?: string | string[] }> | { embed?: string; print?: string },
) {
  const sp =
    searchParams && typeof (searchParams as Promise<{ embed?: string }>).then === 'function'
      ? await (searchParams as Promise<{ embed?: string; print?: string }>)
      : ((searchParams as { embed?: string; print?: string } | undefined) ?? {})
  const flag = (value: string | string[] | undefined) =>
    String(Array.isArray(value) ? value[0] : value ?? '') === '1'
  if (flag(sp.embed) || flag(sp.print)) return
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'customer') {
    redirect(customerDashboardDocUrl(kind, id))
  }
}
