import { PageSection, PublicFaqList, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { pageMetadata } from '@/lib/seo'
import { HelpCircle } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Preguntas frecuentes',
  description:
    'Cómo pedir un crédito en línea, qué tasas se informan, cómo se evalúa y cómo reclamar en UNICRÉDITOS.',
  path: '/preguntas-frecuentes',
})

const FAQS = [
  {
    q: '¿Qué ofrece UNICRÉDITOS?',
    a: 'Crédito personal online y crédito comercial PyME. Simulás cuota, TNA y CFT, verificás identidad con Didit y consultamos la Central de Deudores del BCRA antes de firmar.',
  },
  {
    q: '¿Cómo solicito un préstamo personal?',
    a: 'Creá la cuenta, completá perfil e ingresos, verificá identidad con Didit y solicitá desde el panel. Evaluamos Central de Deudores BCRA y capacidad de pago. Si calificás, firmás el contrato y acreditamos en tu CBU/CVU.',
  },
  {
    q: '¿UNICRÉDITOS es un banco?',
    a: `No. ${LEGAL_COPY.nonBank}`,
  },
  {
    q: '¿Cuánto tarda la evaluación?',
    a: 'No prometemos aprobación en minutos. El tiempo depende de Didit (identidad) y de la respuesta de la API del BCRA. Si el perfil no califica, no hay desembolso.',
  },
  {
    q: '¿Cómo recibo el dinero?',
    a: 'En el CBU o CVU a tu nombre cargado en el panel. La acreditación ocurre cuando tesorería confirma el desembolso.',
  },
  {
    q: '¿Qué tasas voy a ver?',
    a: LEGAL_COPY.cftShort,
  },
  {
    q: '¿Puedo arrepentirme?',
    a: LEGAL_COPY.arrepentimiento,
  },
  {
    q: '¿Cómo reclamo o doy de baja?',
    a: `Por formulario de contacto o email a ${BRAND.supportEmail}. ${LEGAL_COPY.noWhatsapp0800} También tenés botón de arrepentimiento y de baja en la sección legal.`,
  },
]

export default function FaqPage() {
  return (
    <PublicPageShell
      eyebrow="Ayuda"
      title="Preguntas frecuentes"
      description="Respuestas claras sobre crédito en línea, tasas, evaluación y reclamos formales."
      icon={<HelpCircle className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/contacto', label: 'Escribinos' }}
      secondaryAction={{ href: '/sign-up', label: 'Solicitar evaluación' }}
    >
      <PageSection title="Todo lo que necesitás saber">
        <PublicFaqList items={FAQS} />
      </PageSection>
    </PublicPageShell>
  )
}
