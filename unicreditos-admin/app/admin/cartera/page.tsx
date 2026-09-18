"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { BucketBadge } from "@/components/admin/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate, formatPct } from "@/lib/format";
import { findClient, findProduct } from "@/lib/lookups";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function CarteraPage() {
  const { state, source } = useAdmin();
  const router = useRouter();
  const dash = source.dashboard();
  const [bucket, setBucket] = useState("all");
  const active = state.credits.filter((c) => c.status === "active");
  const rows = useMemo(
    () => active.filter((c) => (bucket === "all" ? true : c.bucket === bucket)),
    [active, bucket],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Cartera activa"
        description="Saldo de capital vigente. La mora no genera recargo punitivo."
        actions={
          <NativeSelect value={bucket} onChange={(e) => setBucket(e.target.value)}>
            <option value="all">Todos</option>
            <option value="al_dia">Al día</option>
            <option value="1_30">1–30</option>
            <option value="31_60">31–60</option>
            <option value="61_90">61–90</option>
            <option value="90_plus">90+</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Cartera" value={formatARS(dash.activePortfolio)} hintTone="ok" />
        <StatCard label="Créditos" value={dash.activeCredits} />
        <StatCard label="Ticket" value={formatARS(dash.avgTicket)} />
        <StatCard label="Mora" value={formatPct(dash.moraRate)} hintTone="warn" />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Crédito o cliente…"
        searchFilter={(c, q) => {
          const cl = findClient(state, c.clientId);
          return `${c.id} ${cl?.lastName} ${cl?.dni}`.toLowerCase().includes(q);
        }}
        onRowClick={(c) => router.push(`/admin/creditos/${c.id}`)}
        columns={[
          { key: "id", header: "Crédito", render: (c) => <span className="font-semibold text-brand">{c.id}</span> },
          { key: "cli", header: "Cliente", render: (c) => { const cl = findClient(state, c.clientId); return cl ? clientName(cl) : "—"; } },
          { key: "prd", header: "Producto", render: (c) => findProduct(state, c.productId)?.name },
          { key: "cap", header: "Capital", className: "tabular", render: (c) => formatARS(c.amount) },
          { key: "saldo", header: "Saldo", className: "tabular", render: (c) => formatARS(c.principalOutstanding) },
          { key: "cuota", header: "Cuota", className: "tabular", render: (c) => formatARS(c.installmentAmount) },
          { key: "due", header: "Próx. venc.", render: (c) => formatDate(c.schedule.find((s) => s.status === "pending" || s.status === "overdue")?.dueDate ?? null) },
          { key: "bk", header: "Bucket", render: (c) => <BucketBadge bucket={c.bucket} /> },
        ]}
      />
    </div>
  );
}
