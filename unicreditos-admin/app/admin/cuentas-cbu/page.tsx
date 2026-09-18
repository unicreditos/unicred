"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/data/client";
import { formatARS, formatCbu } from "@/lib/format";

const PURPOSE: Record<string, string> = {
  cobranzas: "Cobranzas",
  desembolsos: "Desembolsos",
  operativa: "Operativa",
};

export default function CuentasCbuPage() {
  const { state } = useAdmin();
  const active = state.accounts.filter((a) => a.active);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Cuentas CBU"
        description="Cuentas de recaudo y liquidación en bancos argentinos y collector MercadoPago."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Cuentas activas" value={active.length} hintTone="ok" />
        <StatCard label="Saldo consolidado" value={formatARS(active.reduce((a, c) => a + c.balance, 0))} />
        <StatCard label="Alias cobranzas" value="UNICRED.COBROS" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {state.accounts.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{a.bank}</p>
                <p className="mt-1 text-[17px] font-semibold">{a.label}</p>
              </div>
              <Badge tone={a.active ? "active" : "cancelled"}>{a.active ? "Activa" : "Inactiva"}</Badge>
            </div>
            <p className="mt-4 text-[12px] text-muted">CBU</p>
            <p className="font-mono text-[13.5px] tabular">{formatCbu(a.cbu)}</p>
            <p className="mt-2 text-[12px] text-muted">Alias</p>
            <p className="font-semibold">{a.alias}</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-[12.5px] text-slate-500">{PURPOSE[a.purpose]} · ARS</span>
              <span className="text-[20px] font-semibold tabular">{formatARS(a.balance)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
