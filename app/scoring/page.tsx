import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BadgeCheck, BarChart3, Building2, FileCheck2, Landmark, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Situación crediticia y consulta BCRA',
  description:
    'Consultá la Central de Deudores del BCRA desde tu cuenta. El score UNICRÉDITOS es interno (300 a 850) y no es un puntaje oficial del Banco Central.',
  path: '/scoring',
})

export default function ScoringPage() {
  const escalas = [
    { nivel: '1', nombre: 'Normal', score: '720 – 850', consejo: 'Mejor perfil interno. La tasa de la oferta sigue siendo la del producto, confirmada en contrato.', tono: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    { nivel: '2', nombre: 'Riesgo bajo', score: '640 – 719', consejo: 'Perfil aceptable. La solicitud se evalúa con BCRA, ingresos y KYC.', tono: 'bg-lime-500/10 text-lime-700 border-lime-500/20' },
    { nivel: '3', nombre: 'Riesgo medio', score: '560 – 639', consejo: 'El motor puede aprobar si la cuota no supera el 35% de los ingresos y la situación BCRA lo permite.', tono: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    { nivel: '4', nombre: 'Insuficiente', score: '300 – 559', consejo: 'Rechazo automático por score interno. Situación BCRA 4 o 5 también rechaza.', tono: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  ]

  return (
    <PublicPageShell
      eyebrow="Consulta con cuenta"
      icon={<Landmark className="h-3.5 w-3.5" />}
      title="Situación crediticia · Central de Deudores BCRA"
      description="El BCRA informa situaciones 1 a 5, no un puntaje 750–999. UNICRÉDITOS calcula un score interno de 300 a 850 con reglas sobre esa Central, cheques e ingresos declarados. La consulta exige cuenta."
      primaryAction={{ href: '/dashboard?tab=scoring', label: 'Ver mi scoring (requiere cuenta)' }}
      secondaryAction={{ href: '/contacto', label: 'Consultar' }}
    >
      <div className="space-y-6">
        <PageSection
          eyebrow="Score UNICRÉDITOS · no es score BCRA"
          title="Bandas del motor actual"
          subtitle="Heurística de reglas, no un modelo de 40 variables. Umbral de aprobación automática: 560."
        >
          <div className="space-y-3">
            {escalas.map((n) => (
              <div key={n.nivel} className={`flex flex-col gap-2 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${n.tono}`}>
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-lg font-bold ring-1 ring-slate-200">{n.nivel}</span>
                  <div>
                    <h3 className="text-base font-bold">{n.nombre}</h3>
                    <p className="text-sm opacity-80">
                      Score UNICRÉDITOS: <span className="font-mono font-semibold">{n.score}</span>
                    </p>
                  </div>
                </div>
                <p className="max-w-xl text-sm leading-relaxed">{n.consejo}</p>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection eyebrow="Capas de validación" title="Qué cruza el motor hoy">
          <Grid cols={4}>
            <FeatureCard icon={<BarChart3 className="h-5 w-5" />} title="1 · BCRA" description="Central de Deudores: entidades, peor situación, deuda y cheques rechazados." badge="API oficial" />
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="2 · Score UNICRÉDITOS" description="Reglas sobre situación, cheques y relación cuota/ingreso. Rango 300–850." />
            <FeatureCard icon={<FileCheck2 className="h-5 w-5" />} title="3 · Ingresos declarados" description="Tope de cuota: 35% del ingreso cargado en el perfil. No hay cruce automático de recibos." />
            <FeatureCard icon={<ShieldAlert className="h-5 w-5" />} title="4 · KYC Didit" description="DNI y prueba de vida. Sin Didit aprobado no hay solicitud." />
          </Grid>
        </PageSection>

        <PageSection eyebrow="Transparencia" title="Qué no prometemos">
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="rounded-2xl border border-slate-200/70 bg-white p-4">No hay programa “Mejorar Score en 90 días” ni “Recuperación Crediticia” como producto.</li>
            <li className="rounded-2xl border border-slate-200/70 bg-white p-4">No hay aprobación “en minutos” garantizada. Depende de Didit y de la API del BCRA.</li>
            <li className="rounded-2xl border border-slate-200/70 bg-white p-4">Una consulta UNICRÉDITOS no es una consulta que el BCRA publique como score numérico.</li>
          </ul>
          <div className="mt-5 rounded-2xl bg-brand-primary-50 p-4 text-sm ring-1 ring-brand-primary/10">
            <p className="font-semibold text-slate-900 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-primary" /> Cómo ver tu informe
            </p>
            <p className="mt-1 text-muted-foreground">Entrá a tu cuenta, pestaña Scoring. Ahí se separa el score UNICRÉDITOS de la situación 1 a 5 del BCRA.</p>
            <Link href="/sign-up" className="mt-2 inline-flex text-sm font-semibold text-brand-primary hover:underline">
              Crear cuenta para consultar →
            </Link>
          </div>
        </PageSection>

        <PageSection eyebrow="En el panel" title="Qué ves si consultás">
          <Grid cols={3}>
            <FeatureCard icon={<Building2 className="h-5 w-5" />} title="Entidades reportadas" description="Bancos y financieras que informan tu situación." />
            <FeatureCard icon={<BadgeCheck className="h-5 w-5" />} title="Detalle por cuenta" description="Monto, situación actual y mora informada por el BCRA." />
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="Reclamos de datos" description="Rectificaciones ante la entidad informante o AAIP. UNICRÉDITOS no corrige el BCRA." />
          </Grid>
        </PageSection>
      </div>
    </PublicPageShell>
  )
}
