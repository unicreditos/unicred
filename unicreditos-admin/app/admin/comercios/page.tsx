"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { MerchantBadge } from "@/components/admin/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { formatARS, formatDate, formatPct } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function ComerciosPage() {
  const { state } = useAdmin();
  const router = useRouter();
  const [st, setSt] = useState("all");
  const rows = useMemo(
    () => state.merchants.filter((m) => (st === "all" ? true : m.status === st)),
    [state.merchants, st],
  );
  const active = state.merchants.filter((m) => m.status === "active");

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Originación"
        title="Comercios"
        description="Puntos de venta adheridos en Argentina para crédito de consumo."
        actions={
          <NativeSelect value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="paused">Pausados</option>
            <option value="onboarding">Alta</option>
            <option value="rejected">Rechazados</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Activos" value={active.length} hintTone="ok" />
        <StatCard label="Volumen histórico" value={formatARS(state.merchants.reduce((a, m) => a + m.volume, 0))} />
        <StatCard label="En onboarding" value={state.merchants.filter((m) => m.status === "onboarding").length} hintTone="info" />
        <StatCard label="Comisión media" value={formatPct(active.reduce((a, m) => a + m.commissionPct, 0) / (active.length || 1))} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Comercio, CUIT, ciudad…"
        searchFilter={(m, q) => `${m.name} ${m.cuit} ${m.city} ${m.category}`.toLowerCase().includes(q)}
        onRowClick={(m) => router.push(`/admin/comercios/${m.id}`)}
        columns={[
          { key: "n", header: "Comercio", render: (m) => <span className="font-semibold">{m.name}</span> },
          { key: "cuit", header: "CUIT", render: (m) => m.cuit },
          { key: "cat", header: "Rubro", render: (m) => m.category },
          { key: "city", header: "Plaza", render: (m) => `${m.city}, ${m.province}` },
          { key: "vol", header: "Volumen", className: "tabular", render: (m) => formatARS(m.volume) },
          { key: "ops", header: "Ops.", className: "tabular", render: (m) => m.originations },
          { key: "com", header: "Comisión", render: (m) => formatPct(m.commissionPct) },
          { key: "alta", header: "Alta", render: (m) => formatDate(m.onboardedAt) },
          { key: "st", header: "Estado", render: (m) => <MerchantBadge status={m.status} /> },
        ]}
      />
    </div>
  );
}
