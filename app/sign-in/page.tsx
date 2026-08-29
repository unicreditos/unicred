import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { pageMetadata } from '@/lib/seo'
import { safeInternalPath } from '@/lib/workspace-gate'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Ingresar',
    description: 'Accedé a tus créditos, cuotas y comprobantes de UNICRÉDITOS.',
    path: '/sign-in',
    noIndex: true,
  }),
  robots: { index: false, follow: true },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string }>
}) {
  const session = await getSession()
  const sp = await searchParams
  if (session?.user?.id) {
    redirect(
      safeInternalPath(sp.next) ||
        safeInternalPath(sp.callbackUrl) ||
        (await getDashboardUrlForUser(session.user.id)),
    )
  }
  return (
    <Suspense fallback={null}>
      <AuthForm mode="sign-in" />
    </Suspense>
  )
}
