import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/seo'
import { UserX } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Botón de baja de servicio',
  description: 'Solicitá la baja de tu cuenta y servicios UNICRÉDITOS.',
  path: '/legal/baja',
})

export default function BajaPage() {
  return (
    <PublicPageShell
      eyebrow="Tu cuenta"
      title="Botón de baja de servicio"
      description="Podés solicitar la baja de la cuenta siempre que no tengas créditos vigentes con saldo, cuotas impagas u órdenes de egreso pendientes."
      icon={<UserX className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/dashboard?tab=cuenta', label: 'Ir a mi cuenta' }}
      secondaryAction={{ href: '/contacto', label: 'Pedir baja por formulario' }}
    >
      <PageSection title="Condiciones">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Sin créditos activos ni mora.</li>
          <li>Sin saldo pendiente de liquidación en billetera hacia terceros.</li>
          <li>
            Escribí a{' '}
            <a className="font-semibold text-brand-primary" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>{' '}
            con asunto “Baja de servicio” e identificación (CUIL / mail).
          </li>
        </ul>
      </PageSection>
    </PublicPageShell>
  )
}
