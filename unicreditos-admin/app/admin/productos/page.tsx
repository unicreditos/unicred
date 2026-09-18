"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/data/client";
import { formatARS, formatPct } from "@/lib/format";

const TYPE: Record<string, string> = {
  personal: "Personal",
  consumo: "Consumo",
  refinanciacion: "Refinanciación",
};

export default function ProductosPage() {
  const { state } = useAdmin();
  const live = state.products.filter((p) => p.active);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Productos"
        description="Oferta de crédito personal y consumo en ARS. TNA/TEA/CFT informados. Sin interés punitivo."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Vigentes" value={live.length} hintTone="ok" />
        <StatCard label="TNA máx. vigente" value={formatPct(Math.max(...live.map((p) => p.tna)), 0)} />
        <StatCard label="Tope" value={formatARS(Math.max(...live.map((p) => p.maxAmount)))} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {state.products.map((p) => {
          const n = state.credits.filter((c) => c.productId === p.id).length;
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{TYPE[p.type]}</p>
                  <p className="mt-1 text-[18px] font-semibold">{p.name}</p>
                </div>
                <Badge tone={p.active ? "active" : "cancelled"}>{p.active ? "Activo" : "Pausado"}</Badge>
              </div>
              <p className="mt-2 text-[13.5px] text-muted">{p.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
                <div>
                  <dt className="text-muted">TNA</dt>
                  <dd className="font-semibold">{formatPct(p.tna, 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted">TEA</dt>
                  <dd className="font-semibold">{formatPct(p.tea, 1)}</dd>
                </div>
                <div>
                  <dt className="text-muted">CFT</dt>
                  <dd className="font-semibold">{formatPct(p.cft, 1)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Monto</dt>
                  <dd>
                    {formatARS(p.minAmount)} – {formatARS(p.maxAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Cuotas</dt>
                  <dd>
                    {p.minInstallments}–{p.maxInstallments}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Cartera mock</dt>
                  <dd>{n} créditos</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
