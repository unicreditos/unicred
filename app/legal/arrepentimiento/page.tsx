import { PublicWithdrawalForm } from '@/components/legal/public-withdrawal-form'
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
      description="Podés dejar sin efecto la aceptación de un crédito dentro de los 10 días corridos (Ley 24.240 art. 34) si el desembolso todavía no se acreditó. No hace falta entrar al panel."
      icon={<Undo2 className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/dashboard?tab=documentos', label: 'Si ya tenés cuenta' }}
      secondaryAction={{ href: '/contacto', label: 'Contactar soporte' }}
    >
      <PageSection title="Formulario público">
        <p className="mb-4 text-sm text-muted-foreground">
          Identificamos la cuenta con CUIL + email. Si el dinero ya se acreditó, este canal no anula el
          crédito: hay que devolver el capital o cancelar el saldo.
        </p>
        <PublicWithdrawalForm />
      </PageSection>
      <PageSection title="Otras vías">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Panel → Documentos, si ya iniciaste sesión.</li>
          <li>
            Email a{' '}
            <a className="font-semibold text-brand-primary" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>{' '}
            con asunto “Arrepentimiento”, CUIL y número de contrato.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Ver también{' '}
          <Link href="/legal/terminos" className="font-semibold text-brand-primary">
            Términos y condiciones
          </Link>
          .
        </p>
      </PageSection>
    </PublicPageShell>
  )
}
