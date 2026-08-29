import type { Metadata } from 'next'
import { RegisterWizard } from '@/components/register-wizard'
import { parseDirectoIntent, directoSolicitarHref } from '@/directo/intent'
import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { pageMetadata } from '@/lib/seo'
import { redirect } from 'next/navigation'

export const metadata: Metadata = pageMetadata({
  title: 'Crear cuenta',
  description:
    'Registrate como persona o comercio. Validamos tu CUIT/CUIL, completamos tus datos y consultamos tu scoring BCRA.',
  path: '/sign-up',
})

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; monto?: string; plazo?: string }>
}) {
  const intent = parseDirectoIntent(await searchParams)
  const session = await getSession()
  if (session?.user?.id) {
    redirect(
      intent.fromDirecto ? directoSolicitarHref(intent) : await getDashboardUrlForUser(session.user.id),
    )
  }
  return <RegisterWizard intent={intent} />
}
