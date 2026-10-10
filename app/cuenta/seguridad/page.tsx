import { redirect } from 'next/navigation'
import { SecuritySettings } from '@/components/auth/security-settings'
import { BackLink } from '@/components/uc/blocks'
import { getDashboardUrlForUser, requireUserId, sessionSecondFactorOk } from '@/lib/session'

export const metadata = { title: 'Seguridad de la cuenta', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SeguridadPage() {
  const userId = await requireUserId()
  if (!(await sessionSecondFactorOk(userId))) redirect('/verificar-2fa?next=/cuenta/seguridad')
  const home = await getDashboardUrlForUser(userId)
  return (
    <main style={{ maxWidth: 760, margin: '6vh auto', padding: 16, display: 'grid', gap: 16 }}>
      <BackLink href={home}>Volver a mi cuenta</BackLink>
      <h1 style={{ fontSize: 24, margin: 0 }}>Seguridad de la cuenta</h1>
      <SecuritySettings />
    </main>
  )
}