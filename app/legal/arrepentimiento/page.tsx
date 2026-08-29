import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/seo'
import { Undo2 } from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Botón de arrepentimiento',
  description:
    'Ejercé el derecho de arrepentimiento previsto por la normativa de defensa del consumidor (10 días corridos).',
  path: '/legal/arrepentimiento',
})

export default function ArrepentimientoPage() {
  return (
    <PublicPageShell
      eyebrow="Defensa del consumidor"
      title="Botón de arrepentimiento"
      description="Podés dejar sin efecto la aceptación de un crédito dentro de los 10 días corridos, conforme la normativa aplicable, si el desembolso aún no se ejecutó o según condiciones del contrato."
      icon={<Undo2 className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/dashboard?tab=documentos', label: 'Gestionar en mi cuenta' }}
      secondaryAction={{ href: '/contacto', label: 'Contactar soporte' }}
    >
      <PageSection title="Cómo ejercerlo">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Ingresá a tu panel → Configuración / cuenta.</li>
          <li>Indicá el crédito o contrato sobre el que te arrepentís.</li>
          <li>
            También podés escribir a{' '}
            <a className="font-semibold text-brand-primary" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>{' '}
            con asunto “Arrepentimiento” y tu CUIL.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Ver también{' '}
          <Link href="/legal/terminos" className="font-semibold text-brand-primary">
            Términos y condiciones
          </Link>{' '}
          y el{' '}
          <Link href="/dashboard?tab=reclamos" className="font-semibold text-brand-primary">
            canal de reclamos Ley 24.240
          </Link>
          .
        </p>
      </PageSection>
    </PublicPageShell>
  )
}
