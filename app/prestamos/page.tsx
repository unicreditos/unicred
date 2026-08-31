import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'
import { BadgeCheck, Banknote, FileCheck2, Scale, ShieldCheck, Smartphone } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Préstamo personal online',
  description:
    'Crédito personal 100% digital. Validá identidad, consultá BCRA y recibí la acreditación en tu CBU/CVU. Cuotas fijas con TNA y CFT a la vista.',
  path: '/prestamos',
})

export default function PrestamosPage() {
  return (
    <PublicPageShell
      eyebrow="Crédito en línea"
      title="Pedilo online. Lo evaluamos. Lo acreditamos en tu cuenta."
      description={`Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)} en ${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas fijas. El primer crédito está acotado a ${formatARS(FIRST_CREDIT_HARD_CAP)}. Sin sucursal, con KYC biométrico y Central de Deudores BCRA.`}
      icon={<Banknote className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/sign-up', label: 'Solicitar evaluación' }}
      secondaryAction={{ href: '/simulador', label: 'Simular cuota' }}
    >
      <PageSection eyebrow="En 3 pasos" title="Cómo se pide el crédito">
        <Grid cols={3}>
          <FeatureCard
            icon={<Smartphone className="h-5 w-5" />}
            title="1 · Ingresá tus datos"
            description="Creá la cuenta con DNI, CUIL, mail y celular. Declarás ingresos y domicilio."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="2 · Validá tu identidad"
            description="Didit verifica DNI y prueba de vida. Consultamos la Central de Deudores del BCRA con tu autorización."
          />
          <FeatureCard
            icon={<Banknote className="h-5 w-5" />}
            title="3 · Recibí el dinero"
            description="Si calificás, firmás el contrato y acreditamos en el CBU/CVU a tu nombre cuando tesorería confirma."
          />
        </Grid>
      </PageSection>

      <PageSection eyebrow="Números de referencia" title="Catálogo vigente">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Monto máximo', d: formatARS(PERSONAL_QUOTE.maxAmount) },
            { t: 'Plazo', d: `${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} meses` },
            { t: 'TNA ref.', d: PERSONAL_QUOTE.tnaLabel },
            { t: 'CFT ref.', d: PERSONAL_QUOTE.cftLabel },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{x.t}</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-brand-navy">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{PERSONAL_QUOTE.metricHint}. Sujeto a evaluación. {LEGAL_COPY.cftShort}</p>
      </PageSection>

      <PageSection eyebrow="Requisitos" title="Qué necesitás">
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            'Mayor de 18 años con DNI argentino',
            'Celular y mail propios',
            'Ingresos declarados y CBU/CVU a tu nombre',
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-2xl border border-border/70 bg-card p-4 text-sm"
            >
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              {item}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection eyebrow="Transparencia" title="Qué queda por escrito">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileCheck2, t: 'TNA y CFT', d: 'Siempre a la vista antes de firmar.' },
            { icon: Scale, t: 'Mutuo y pagaré', d: 'Contrato, cuponera y recibos en tu panel.' },
            { icon: ShieldCheck, t: 'Arrepentimiento', d: '10 días corridos según Ley 24.240.' },
            { icon: Banknote, t: 'Operador', d: `${BRAND.legalName} · CUIT ${BRAND.cuit}.` },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-brand-primary/10 bg-brand-primary/5 p-4">
              <x.icon className="h-5 w-5 text-brand-primary" />
              <div className="mt-3 text-sm font-bold text-brand-navy">{x.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{LEGAL_COPY.nonBank}</p>
      </PageSection>
    </PublicPageShell>
  )
}
