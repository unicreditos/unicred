import { redirect } from 'next/navigation'
import { SecondFactorForm } from '@/components/auth/second-factor-form'
import { getRoleForUser, requireUserId } from '@/lib/session'
import { userHasTotp } from '@/lib/totp'
import { safeNextPath } from '@/lib/second-factor-core'

export const metadata = { title: 'Verificación en dos pasos', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function Verificar2faPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  const { next } = await searchParams
  const fallback = role === 'admin' ? '/admin' : role === 'merchant' ? '/merchant' : '/dashboard'
  const target = safeNextPath(next, fallback)
  if (!target) redirect(fallback)
  const endpoint = role === 'admin' ? '/api/admin/2fa' : '/api/2fa'
  const totpEnabled = await userHasTotp(userId)
  return (
    <main style={{ maxWidth: 420, margin: '10vh auto', padding: 16 }}>
      <SecondFactorForm endpoint={endpoint} next={target} totpEnabled={totpEnabled} />
    </main>
  )
}