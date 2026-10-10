import { AccountSettings } from '@/components/dashboard/account-settings'
import { ButtonLink, Callout, PageHead } from '@/components/uc/blocks'

export const metadata = { title: 'Seguridad' }

export default function SeguridadPage() {
  return (
    <>
      <PageHead
        title="Seguridad"
        description="Cambiá tu contraseña y revisá cómo cuidamos tu cuenta."
        actions={
          <ButtonLink primary href="/cuenta/seguridad">
            Verificación en dos pasos y sesiones
          </ButtonLink>
        }
      />
      <Callout icon="lock" title="Protegé tu cuenta con la verificación en dos pasos">
        Activá una app autenticadora, guardá tus códigos de respaldo y revisá los dispositivos con sesión abierta desde{' '}
        <a href="/cuenta/seguridad">Verificación en dos pasos</a>.
      </Callout>
      <AccountSettings />
    </>
  )
}
