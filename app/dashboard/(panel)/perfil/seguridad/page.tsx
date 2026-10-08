import { AccountSettings } from '@/components/dashboard/account-settings'
import { PageHead } from '@/components/uc/blocks'

export const metadata = { title: 'Seguridad' }

export default function SeguridadPage() {
  return (
    <>
      <PageHead title="Seguridad" description="Cambiá tu contraseña y revisá cómo cuidamos tu cuenta." />
      <AccountSettings />
    </>
  )
}
