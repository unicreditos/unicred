import type { Metadata } from 'next'
import { RequestPasswordResetForm } from '@/components/auth/request-password-reset-form'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Pedí un enlace para restablecer la contraseña de tu cuenta UNICRÉDITOS.',
  robots: { index: false, follow: false },
}

export default async function RecuperarClavePage() {
  const session = await getSession()
  if (session?.user?.id) {
    redirect(await getDashboardUrlForUser(session.user.id))
  }
  return <RequestPasswordResetForm />
}
