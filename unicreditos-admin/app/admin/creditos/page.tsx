"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { BucketBadge, LoanStatusBadge } from "@/components/admin/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate } from "@/lib/format";
import { findClient, findProduct } from "@/lib/lookups";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function CreditosPage() {
  const { state } = useAdmin();
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const rows = useMemo(
    () => state.credits.filter((c) => (status === "all" ? true : c.status === status)),
    [state.credits, status],
  );
  const active = state.credits.filter((c) => c.status === "active");

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Originación"
        title="Créditos"
        description="Cartera de mutuos en pesos. Estados: calificado, vigente, cancelado, anulado."
        actions={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="approved">Calificado</option>
            <option value="active">Vigente</option>
            <option value="paid">Cancelado</option>
            <option value="cancelled">Anulado</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Vigentes" value={active.length} hintTone="ok" hint="Con desembolso acreditado" />
        <StatCard label="Saldo" value={formatARS(active.reduce((a, c) => a + c.principalOutstanding, 0))} />
        <StatCard label="Calificados (sin desembolsar)" value={state.credits.filter((c) => c.status === "approved").length} hint="Cola de tesorería" hintTone="warn" />
        <StatCard label="Cancelados" value={state.credits.filter((c) => c.status === "paid").length} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Buscar crédito, cliente…"
        searchFilter={(c, q) => {
          const cl = findClient(state, c.clientId);
          return `${c.id} ${cl?.firstName} ${cl?.lastName} ${cl?.dni}`.toLowerCase().includes(q);
        }}
        onRowClick={(c) => router.push(`/admin/creditos/${c.id}`)}
        columns={[
          { key: "id", header: "Crédito", render: (c) => <span className="font-semibold text-brand">{c.id}</span> },
          {
            key: "cli",
            header: "Cliente",
            render: (c) => {
              const cl = findClient(state, c.clientId);
              return cl ? clientName(cl) : "—";
            },
          },
          { key: "prd", header: "Producto", render: (c) => findProduct(state, c.productId)?.name },
          { key: "amt", header: "Capital", className: "tabular", render: (c) => formatARS(c.amount) },
          { key: "saldo", header: "Saldo", className: "tabular", render: (c) => formatARS(c.principalOutstanding) },
          { key: "cuota", header: "Cuota", className: "tabular", render: (c) => formatARS(c.installmentAmount) },
          { key: "tna", header: "TNA", render: (c) => `${c.tna}%` },
          { key: "due", header: "1er venc.", render: (c) => formatDate(c.firstDueDate) },
          { key: "bk", header: "Mora", render: (c) => <BucketBadge bucket={c.bucket} /> },
          { key: "st", header: "Estado", render: (c) => <LoanStatusBadge status={c.status} /> },
        ]}
      />
    </div>
  );
}
