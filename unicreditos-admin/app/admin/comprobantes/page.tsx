"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import { useMemo, useState } from "react";

export default function ComprobantesPage() {
  const { state } = useAdmin();
  const [type, setType] = useState("all");
  const rows = useMemo(
    () => state.receipts.filter((r) => (type === "all" ? true : r.type === type)),
    [state.receipts, type],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Comprobantes"
        description="Recibos de cobro (con CAE mock) y constancias de desembolso."
        actions={
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Todos</option>
            <option value="cobro">Cobranzas</option>
            <option value="desembolso">Desembolsos</option>
            <option value="nota_credito">Notas de crédito</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Emitidos" value={state.receipts.length} />
        <StatCard label="Cobranzas" value={formatARS(state.receipts.filter((r) => r.type === "cobro").reduce((a, r) => a + r.amount, 0))} hintTone="ok" />
        <StatCard label="Desembolsos" value={formatARS(state.receipts.filter((r) => r.type === "desembolso").reduce((a, r) => a + r.amount, 0))} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Número, CAE, cliente…"
        searchFilter={(r, q) => {
          const c = findClient(state, r.clientId);
          return `${r.number} ${r.cae} ${c?.lastName}`.toLowerCase().includes(q);
        }}
        columns={[
          { key: "n", header: "Comprobante", render: (r) => <span className="font-semibold">{r.number}</span> },
          {
            key: "t",
            header: "Tipo",
            render: (r) => (
              <Badge tone={r.type === "cobro" ? "active" : r.type === "desembolso" ? "info" : "pending"}>
                {r.type === "cobro" ? "Cobro" : r.type === "desembolso" ? "Desembolso" : "NC"}
              </Badge>
            ),
          },
          {
            key: "cli",
            header: "Cliente",
            render: (r) => {
              const c = findClient(state, r.clientId);
              return c ? clientName(c) : "—";
            },
          },
          { key: "amt", header: "Importe", className: "tabular", render: (r) => formatARS(r.amount) },
          { key: "cae", header: "CAE", render: (r) => r.cae ?? "— interno" },
          { key: "fecha", header: "Emisión", render: (r) => formatDate(r.issuedAt) },
        ]}
      />
    </div>
  );
}
