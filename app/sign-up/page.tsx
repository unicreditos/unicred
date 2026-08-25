import type { Metadata } from 'next'
import { RegisterWizard } from '@/components/register-wizard'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Crear cuenta | UNICRÉDITOS',
  description:
    'Registrate como persona o comercio. Validamos tu CUIT/CUIL, completamos tus datos y consultamos tu scoring BCRA.',
}

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user?.id) {
    redirect(await getDashboardUrlForUser(session.user.id))
  }
  return <RegisterWizard />
}
