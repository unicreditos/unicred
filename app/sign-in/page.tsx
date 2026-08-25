import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Ingresar | UNICRÉDITOS',
  description: 'Accedé a tus créditos, cuotas y comprobantes de UNICRÉDITOS.',
  robots: { index: false, follow: true },
}

export default async function SignInPage() {
  const session = await getSession()
  if (session?.user?.id) {
    redirect(await getDashboardUrlForUser(session.user.id))
  }
  return (
    <Suspense fallback={null}>
      <AuthForm mode="sign-in" />
    </Suspense>
  )
}
