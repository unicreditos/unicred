import type { Metadata } from 'next'
import { SignupSessionGate } from '@/components/auth/signup-session-gate'
import { RegisterWizard } from '@/components/register-wizard'
import { hasLoanIntent, parseLoanIntent } from '@/lib/loan-intent'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Crear cuenta',
  description:
    'Registrate con tu DNI o CUIL, confirmá tu identidad, cargá email y celular, creá tu contraseña y verificá con Didit.',
  path: '/sign-up',
})

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ monto?: string; plazo?: string }>
}) {
  const intent = parseLoanIntent(await searchParams)
  const session = await getSession()
  if (session?.user?.id && !hasLoanIntent(intent)) {
    return <SignupSessionGate panelHref={await getDashboardUrlForUser(session.user.id)} />
  }
  return <RegisterWizard intent={intent} />
}
