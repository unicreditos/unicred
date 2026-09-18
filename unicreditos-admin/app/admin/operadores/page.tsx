"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/data/client";
import { formatDateTime, ROLE_LABEL } from "@/lib/format";

export default function OperadoresPage() {
  const { state } = useAdmin();
  const live = state.operators.filter((o) => o.active);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Operadores"
        description="Equipo del backoffice Argentina. Roles de originación, tesorería, riesgo y auditoría."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Activos" value={live.length} hintTone="ok" />
        <StatCard label="Inactivos" value={state.operators.length - live.length} />
        <StatCard label="Dirección" value={state.operators.filter((o) => o.role === "director").length} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.operators.map((o) => (
          <div key={o.id} className="card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-mint">
                {o.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{o.name}</p>
                  <Badge tone={o.active ? "active" : "cancelled"}>{o.active ? "Activo" : "Baja"}</Badge>
                </div>
                <p className="truncate text-[13px] text-muted">{o.email}</p>
                <p className="mt-2 text-[13px]">{ROLE_LABEL[o.role]}</p>
                <p className="text-[12px] text-slate-400">Último acceso {formatDateTime(o.lastSeen)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
