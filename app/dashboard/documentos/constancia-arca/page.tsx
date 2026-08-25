import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function MyArcaConstanciaPage() {
  const userId = await requireUserId()
  redirect(`/dashboard/documentos/constancia-arca/${userId}`)
}
