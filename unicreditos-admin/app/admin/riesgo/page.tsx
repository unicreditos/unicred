"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { CENDEU_LABEL, clientName, formatDateTime } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import Link from "next/link";
import { useMemo, useState } from "react";

const tone = {
  ok: "active",
  novedad: "pending",
  irregular: "rejected",
  sin_info: "cancelled",
} as const;

export default function RiesgoPage() {
  const { state } = useAdmin();
  const [res, setRes] = useState("all");
  const rows = useMemo(
    () => state.cendeu.filter((r) => (res === "all" ? true : r.result === res)),
    [state.cendeu, res],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Riesgo"
        title="Riesgo / CENDEU"
        description="Consultas BCRA CENDEU de personas humanas. Informativo para la mesa de crédito."
        actions={
          <NativeSelect value={res} onChange={(e) => setRes(e.target.value)}>
            <option value="all">Todas</option>
            <option value="ok">Situación 1</option>
            <option value="novedad">Novedad</option>
            <option value="irregular">Irregular</option>
            <option value="sin_info">Sin información</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Consultas" value={state.cendeu.length} />
        <StatCard label="Sit. 1" value={state.cendeu.filter((r) => r.result === "ok").length} hintTone="ok" />
        <StatCard label="Novedades" value={state.cendeu.filter((r) => r.result === "novedad").length} hintTone="warn" />
        <StatCard label="Irregulares" value={state.cendeu.filter((r) => r.result === "irregular").length} hintTone="bad" />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Cliente, observación…"
        searchFilter={(r, q) => {
          const c = findClient(state, r.clientId);
          return `${c?.lastName} ${c?.dni} ${r.observations}`.toLowerCase().includes(q);
        }}
        columns={[
          {
            key: "cli",
            header: "Cliente",
            render: (r) => {
              const c = findClient(state, r.clientId);
              return c ? (
                <Link className="font-semibold text-brand" href={`/admin/clientes/${c.id}`}>
                  {clientName(c)}
                </Link>
              ) : "—";
            },
          },
          { key: "res", header: "Resultado", render: (r) => <Badge tone={tone[r.result]}>{CENDEU_LABEL[r.result]}</Badge> },
          { key: "sc", header: "Score", className: "tabular", render: (r) => r.score },
          { key: "ent", header: "Entidades", render: (r) => r.entities },
          { key: "s1", header: "Sit1–5", render: (r) => `${r.sit1}/${r.sit2}/${r.sit3}/${r.sit4}/${r.sit5}` },
          { key: "obs", header: "Observación", render: (r) => <span className="text-[12.5px] text-slate-600">{r.observations}</span> },
          { key: "fecha", header: "Consulta", render: (r) => formatDateTime(r.consultedAt) },
        ]}
      />
    </div>
  );
}
