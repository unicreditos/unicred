import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/seo'
import { HelpCircle } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Preguntas frecuentes',
  description:
    'Cómo sacar un préstamo, comprar en cuotas, pagar servicios y gestionar tu cuenta UNICRÉDITOS.',
  path: '/preguntas-frecuentes',
})

const FAQS = [
  {
    q: '¿Qué ofrece UNICRÉDITOS?',
    a: 'Préstamos personales digitales, crédito comercial PyME, compras en cuotas sin tarjeta (tienda física y online), billetera con transferencias, pagos de servicios y recargas, scoring BCRA y documentación completa en el panel.',
  },
  {
    q: '¿Cómo solicito un préstamo personal?',
    a: 'Creá la cuenta, completá perfil e ingresos, verificá identidad con Didit y simulá/solicitá desde el panel. Evaluamos Central de Deudores BCRA y capacidad de pago. Si calificás, firmás el contrato y acreditamos en tu CBU/CVU.',
  },
  {
    q: '¿Puedo comprar en cuotas sin tarjeta de crédito?',
    a: 'Sí. En comercios adheridos (físico u online) financiás con tu cuenta UNICRÉDITOS. El deudor sos vos; el comercio cobra el neto cuando acreditamos.',
  },
  {
    q: '¿Hay cuotas sin interés?',
    a: 'En promociones de comercios adheridos, el local puede absorber el interés (0% para vos). Fuera de promo, ves TNA y CFT antes de firmar.',
  },
  {
    q: '¿Cómo recibo el dinero del préstamo?',
    a: 'En el CBU o CVU a tu nombre cargado en el panel. La acreditación ocurre cuando tesorería confirma el desembolso.',
  },
  {
    q: '¿Puedo pagar servicios y recargar el celular?',
    a: 'Sí, desde el tab Servicios del panel (con saldo en Billetera). El débito es inmediato; tesorería RM liquida al prestador.',
  },
  {
    q: '¿UNICRÉDITOS es un banco?',
    a: `No. ${BRAND.company} es la unidad de créditos de Grupo Emprenor, operada por ${BRAND.legalName}. Originamos y administramos créditos sujetos a evaluación.`,
  },
  {
    q: '¿Cómo doy de baja o me arrepiento?',
    a: 'Tenés botón de arrepentimiento (10 días) y de baja de servicio en la sección legal del sitio y en tu panel de cuenta.',
  },
]

export default function FaqPage() {
  return (
    <PublicPageShell
      eyebrow="Ayuda"
      title="Preguntas frecuentes"
      description="Respuestas claras sobre préstamos, cuotas, billetera y pagos de servicios."
      icon={<HelpCircle className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/contacto', label: 'Escribinos' }}
      secondaryAction={{ href: '/sign-up', label: 'Crear cuenta' }}
    >
      <PageSection title="Todo lo que necesitás saber">
        <div className="space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border/70 bg-card px-5 py-4 open:border-brand-primary/30"
            >
              <summary className="cursor-pointer list-none text-sm font-bold text-brand-navy marker:content-none">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </PageSection>
    </PublicPageShell>
  )
}
