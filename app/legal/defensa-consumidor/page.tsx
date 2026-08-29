import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/seo'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Defensa del consumidor',
  description: 'Canales de reclamo, arrepentimiento y baja conforme Ley 24.240.',
  path: '/legal/defensa-consumidor',
})

export default function DefensaConsumidorPage() {
  return (
    <PublicPageShell
      eyebrow="Ley 24.240"
      title="Defensa del consumidor"
      description="Canales formales para reclamos, arrepentimiento y baja de servicio."
      icon={<Shield className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/dashboard?tab=reclamos', label: 'Abrir reclamo' }}
      secondaryAction={{ href: '/contacto', label: 'Contacto' }}
    >
      <PageSection title="Canales">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <Link href="/dashboard?tab=reclamos" className="font-semibold text-brand-primary">
              Mesa de reclamos
            </Link>{' '}
            en tu panel (Ley 24.240).
          </li>
          <li>
            <Link href="/legal/arrepentimiento" className="font-semibold text-brand-primary">
              Botón de arrepentimiento
            </Link>
          </li>
          <li>
            <Link href="/legal/baja" className="font-semibold text-brand-primary">
              Botón de baja
            </Link>
          </li>
          <li>
            Email:{' '}
            <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-brand-primary">
              {BRAND.supportEmail}
            </a>
          </li>
        </ul>
      </PageSection>
    </PublicPageShell>
  )
}
