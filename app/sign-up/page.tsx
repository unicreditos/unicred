import type { Metadata } from 'next'
import { RegisterWizard } from '@/components/register-wizard'
import { hasLoanIntent, parseLoanIntent, solicitarHref } from '@/lib/loan-intent'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { pageMetadata } from '@/lib/seo'
import { redirect } from 'next/navigation'

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
  if (session?.user?.id) {
    redirect(hasLoanIntent(intent) ? solicitarHref(intent) : await getDashboardUrlForUser(session.user.id))
  }
  return <RegisterWizard intent={intent} />
}
