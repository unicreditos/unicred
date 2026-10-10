import { IdentityGuide } from '@/components/identity-guide'
import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { pageMetadata } from '@/lib/seo'
import { ScanFace } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Guía de verificación de identidad',
  description:
    'Cómo es la verificación de identidad con Didit en UNICRÉDITOS: DNI frente y dorso, prueba de vida y coincidencia facial, qué resultados puede dar y qué hacer si no se aprueba.',
  path: '/verificacion-de-identidad',
})

export default function VerificacionDeIdentidadPage() {
  return (
    <PublicPageShell
      eyebrow="Verificación de identidad"
      title="Cómo verificamos tu identidad"
      description="Antes de operar confirmamos que sos vos, con tu DNI y tu cara. Se hace con Didit, dentro de UNICRÉDITOS, desde el celular o la computadora."
      icon={<ScanFace className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/sign-up', label: 'Crear mi cuenta' }}
      secondaryAction={{ href: '/preguntas-frecuentes', label: 'Preguntas frecuentes' }}
    >
      <PageSection eyebrow="Paso a paso" title="Qué te va a pedir la verificación">
        <IdentityGuide />
      </PageSection>
    </PublicPageShell>
  )
}
