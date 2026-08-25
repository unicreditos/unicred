import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { formatARS } from '@/lib/finance'
import { CONSUMO_QUOTE } from '@/lib/loan-catalog'
import { ArrowRight, BadgeCheck, Calculator, Landmark, ShieldCheck, Store, Users } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Comercios y PyMEs · UNICRÉDITOS',
  description:
    'Adherí tu comercio para ofrecer cuotas. El cliente debe tener cuenta UNICRÉDITOS y KYC. Comisión informada al adherir. Sin costo de alta.',
}

export default function ComerciosPage() {
  return (
    <PublicPageShell
      eyebrow="Red de comercios"
      title="Ofrecé cuotas. El deudor es tu cliente."
      icon={<Store className="h-3.5 w-3.5" />}
      description="El comercio adhiere, carga el CUIL del comprador y UNICRÉDITOS evalúa a esa persona. No hay “cuotas sin interés”: el CFT lo paga el cliente. No hay cobro en 48 horas garantizado."
      primaryAction={{ href: '/sign-up?plan=merchant', label: 'Adherir mi comercio' }}
      secondaryAction={{ href: '/contacto', label: 'Consultar por formulario' }}
    >
      <div className="space-y-6">
        <PageSection
          eyebrow="Reglas del producto"
          title="Cómo funciona de verdad"
          subtitle={`Línea consumo: TNA ${CONSUMO_QUOTE.tnaLabel} · CFT ${CONSUMO_QUOTE.cftLabel} de referencia. Tope ${formatARS(CONSUMO_QUOTE.maxAmount)}.`}
        >
          <Grid cols={4}>
            <FeatureCard icon={<Users className="h-5 w-5" />} title="Cliente con cuenta" description="Sin CUIL UNICRÉDITOS y KYC Didit aprobado no se origina el crédito." />
            <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Evaluación UNICRÉDITOS" description="Central de Deudores, score interno y tope de cuota 35% del ingreso." />
            <FeatureCard icon={<Calculator className="h-5 w-5" />} title="Comisión al comercio" description="Un porcentaje sobre la venta aprobada, informado al activar el comercio. Default operativo 8%." />
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="Acreditación" description="El neto se paga cuando tesorería marca el desembolso. No hay SLA de 48 horas." />
          </Grid>
        </PageSection>

        <PageSection eyebrow="Qué no prometemos" title="Publicidad que sacamos">
          <ul className="grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
            {[
              'No hay ticket medio de $94.000 ni “+38%”.',
              'No hay “0 fraude” ni cobro 100% garantizado.',
              'No hay WhatsApp automático, multi-sucursal ni roles de vendedor.',
              'No hay cuotas sin interés para el consumidor.',
            ].map((t) => (
              <li key={t} className="rounded-2xl border border-slate-200/70 bg-white p-4">
                {t}
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection eyebrow="Requisitos adhesión" title="Qué pedimos al comercio">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'CUIT consultado en el padrón ARCA (monotributo, IVA RI o exento, clave activa)',
              'Didit del titular o representante: DNI + prueba de vida. No se sube constancia a mano',
              'Si es persona jurídica: estatuto y acta de designación o poder',
              'CBU o CVU a nombre del comercio',
              'Habilitación de UNICRÉDITOS después de cruzar ARCA y Didit',
              'El comprador debe registrarse en UNICRÉDITOS',
            ].map((r) => (
              <li key={r} className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white p-4 text-sm leading-relaxed text-slate-700">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {r}
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection eyebrow="Alta" title="Tres pasos">
          <ol className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
            {[
              { t: '1 · Creás la cuenta comercio', d: 'CUIT en ARCA, Didit del titular y, si es sociedad, el expediente. Queda pendiente.' },
              { t: '2 · UNICRÉDITOS valida', d: 'Se vuelve a consultar ARCA. Sin Didit, clave inactiva o expediente incompleto no se habilita.' },
              { t: '3 · Cargás el CUIL del cliente', d: 'Si califica, se origina el crédito a su nombre.' },
            ].map((s) => (
              <li key={s.t} className="rounded-2xl border border-slate-200/70 bg-white p-5">
                <h3 className="text-base font-bold text-slate-900">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Link href="/sign-up?plan=merchant" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Adherir comercio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </PageSection>
      </div>
    </PublicPageShell>
  )
}
