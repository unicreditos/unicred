import { redirect } from 'next/navigation'
import { SecuritySettings } from '@/components/auth/security-settings'
import { requireUserId, sessionSecondFactorOk } from '@/lib/session'

export const metadata = { title: 'Seguridad de la cuenta', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SeguridadPage() {
  const userId = await requireUserId()
  if (!(await sessionSecondFactorOk(userId))) redirect('/verificar-2fa?next=/cuenta/seguridad')
  return (
    <main style={{ maxWidth: 760, margin: '6vh auto', padding: 16, display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Seguridad de la cuenta</h1>
      <SecuritySettings />
    </main>
  )
}