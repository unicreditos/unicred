import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { COMERCIO_QUOTE, CONSUMO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { pageMetadata } from '@/lib/seo'
import { Percent } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Comisiones, cargos y tasas',
  description: 'TNA, CFT y rangos de referencia del catálogo UNICRÉDITOS.',
  path: '/legal/tasas',
})

export default function TasasPage() {
  const rows = [PERSONAL_QUOTE, CONSUMO_QUOTE, COMERCIO_QUOTE]

  return (
    <PublicPageShell
      eyebrow="Transparencia"
      title="Comisiones, cargos y tasas"
      description="Referencias del catálogo operativo. TNA, TEA y CFT est. (IVA sobre intereses) se confirman en la oferta y el mutuo."
      icon={<Percent className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/simulador', label: 'Simular cuota' }}
    >
      <PageSection title="Catálogo vigente">
        <div className="overflow-x-auto rounded-2xl border border-border/70">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">TNA ref.</th>
                <th className="px-4 py-3">TEA ref.</th>
                <th className="px-4 py-3">CFT est.</th>
                <th className="px-4 py-3">Plazo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-semibold text-brand-navy">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums">{p.tnaLabel}</td>
                  <td className="px-4 py-3 tabular-nums">{p.teaLabel}</td>
                  <td className="px-4 py-3 tabular-nums">{p.cftLabel}</td>
                  <td className="px-4 py-3">
                    {p.minTerm}–{p.maxTerm} meses
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Sistema francés (cuota fija). CFT = TEA × 1,21 (IVA 21% sobre intereses), sin seguros ni
          gastos de otorgamiento. Punitorios: 0%. Comisiones de comercio se informan al adherir el
          local. No hay cargos ocultos post-firma fuera del contrato.
        </p>
      </PageSection>
    </PublicPageShell>
  )
}
