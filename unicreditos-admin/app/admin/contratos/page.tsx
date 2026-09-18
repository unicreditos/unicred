"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { formatDate } from "@/lib/format";
import { findProduct } from "@/lib/lookups";
import { useMemo, useState } from "react";

const tone = {
  active: "active",
  draft: "pending",
  archived: "cancelled",
} as const;

export default function ContratosPage() {
  const { state } = useAdmin();
  const [st, setSt] = useState("all");
  const rows = useMemo(
    () => state.contracts.filter((c) => (st === "all" ? true : c.status === st)),
    [state.contracts, st],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Contratos"
        description="Plantillas de mutuo personal y consumo. Versiones vigentes para firmar en originación."
        actions={
          <NativeSelect value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Todas</option>
            <option value="active">Vigentes</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivo</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Vigentes" value={state.contracts.filter((c) => c.status === "active").length} hintTone="ok" />
        <StatCard label="Borradores" value={state.contracts.filter((c) => c.status === "draft").length} />
        <StatCard label="Cláusulas (vigentes)" value={state.contracts.filter((c) => c.status === "active").reduce((a, c) => a + c.clauses, 0)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">v{c.version}</p>
                <p className="mt-1 text-[16px] font-semibold">{c.name}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {c.productId ? findProduct(state, c.productId)?.name : "Transversal"}
                </p>
              </div>
              <Badge tone={tone[c.status]}>
                {c.status === "active" ? "Vigente" : c.status === "draft" ? "Borrador" : "Archivo"}
              </Badge>
            </div>
            <div className="mt-4 flex justify-between text-[13px] text-slate-600">
              <span>{c.clauses} cláusulas</span>
              <span>Actualizado {formatDate(c.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
