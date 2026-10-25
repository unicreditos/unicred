import type { Metadata } from 'next'
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
  // El aviso de sesión abierta lo decide el asistente: durante el alta la propia cuenta nueva abre sesión y la
  // página se vuelve a renderizar; si acá se reemplazara el asistente por el aviso, la persona perdería el paso
  // final ("Tu cuenta está lista") y parecería que el registro falló.
  const activeSessionPanelHref =
    session?.user?.id && !hasLoanIntent(intent) ? await getDashboardUrlForUser(session.user.id) : null
  return <RegisterWizard intent={intent} activeSessionPanelHref={activeSessionPanelHref} />
}
