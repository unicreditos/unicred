import { LoanSimulator } from '@/components/loan-simulator'
import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BadgeCheck, Calculator, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Simulador de crédito online',
  description:
    'Simulá un préstamo personal o comercial. Calculá cuota, TNA y CFT. Los valores son informativos y no constituyen oferta.',
  path: '/simulador',
})

export default function SimuladorPage() {
  return (
    <PublicPageShell
      eyebrow="Herramienta gratuita"
      title="Simulador de crédito online"
      description="Ajustá monto y plazo. Ves cuota estimada, TNA, TEA y CFT (IVA sobre intereses). Sin compromiso. No es una oferta."
      icon={<Calculator className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/sign-up', label: 'Solicitar este crédito' }}
      secondaryAction={{ href: '/productos', label: 'Ver productos' }}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PageSection eyebrow="Calculadora TNA · TEA · CFT" title="Simulá en 3 pasos">
            <LoanSimulator />
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-slate-100 px-3 py-1">🔒 Sin compromiso</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">📊 Costos transparentes</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">⚡ Resultado al instante</span>
            </div>
          </PageSection>
        </div>
        <aside className="space-y-6 lg:col-span-2">
          <PageSection eyebrow="Por qué usar el simulador" title="Tomá decisiones informadas">
            <ul className="space-y-3 text-sm leading-relaxed text-slate-700">
              {[
                'Cuota estimada según TNA, TEA, plazo y sistema francés.',
                'Total a devolver, intereses estimados y CFT = TEA × 1,21 (IVA sobre intereses).',
                'Compará plazos de 3, 12, 24 y 48 cuotas antes de solicitar.',
                'La oferta contractual puede diferir según evaluación de capacidad de pago.',
              ].map(x => (
                <li key={x} className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {x}
                </li>
              ))}
            </ul>
          </PageSection>

          <PageSection eyebrow="Glosario" title="Qué significan las tasas">
            <dl className="space-y-3 text-sm">
              <div><dt className="font-semibold text-slate-900">TNA · Tasa Nominal Anual</dt><dd className="text-muted-foreground">TEM × 12. Interés anual sin capitalizar.</dd></div>
              <div><dt className="font-semibold text-slate-900">TEA · Tasa Efectiva Anual</dt><dd className="text-muted-foreground">(1 + TEM)^12 − 1. Exigida por Ley 24.240 art. 36 inc. d.</dd></div>
              <div><dt className="font-semibold text-slate-900">CFT est. (IVA sobre intereses)</dt><dd className="text-muted-foreground">TEA × 1,21. Sin seguros ni gastos. No es el CFT de flujos de un sujeto BCRA. Este mutuo se informa por Ley 24.240, no por la Ley de tarjetas 25.065.</dd></div>
            </dl>
          </PageSection>

          <PageSection eyebrow="Listo para aplicar" title="Siguiente paso">
            <div className="rounded-2xl bg-gradient-to-br from-brand-primary/10 via-white to-brand-cian-500/10 p-5 ring-1 ring-brand-primary/10">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-primary shadow-sm ring-1 ring-slate-200"><FileText className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Siguiente paso: evaluación</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Creá tu cuenta → verificá DNI con Didit → indicá CBU e ingresos → si calificás, firmás con TNA y CFT a la vista.</p>
                  <Link href="/sign-up" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">Solicitar evaluación →</Link>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200/60">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Datos cifrados. Ley 25.326. No hay WhatsApp ni 0800 como canal de cobro.
            </div>
          </PageSection>
        </aside>
      </div>
    </PublicPageShell>
  )
}
