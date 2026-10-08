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
    description: 'Accedé a tus créditos, documentos y comprobantes de UNICRÉDITOS.',
    path: '/sign-in',
    noIndex: true,
  }),
  robots: { index: false, follow: true },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string; error?: string }>
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
  const notice =
    sp.error === 'session_expired'
      ? 'Por seguridad la sesión del backoffice venció. Ingresá de nuevo.'
      : sp.error === 'banned'
        ? 'No se pudo iniciar sesión con esta cuenta.'
        : null
  return (
    <>
      {notice ? (
        <p role="status" className="mx-auto mt-6 max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          {notice}
        </p>
      ) : null}
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </>
  )
}
