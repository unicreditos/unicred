"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { formatDateTime } from "@/lib/format";
import { findOperator } from "@/lib/lookups";
import { useMemo, useState } from "react";

export default function AuditoriaPage() {
  const { state } = useAdmin();
  const [entity, setEntity] = useState("all");
  const entities = useMemo(
    () => Array.from(new Set(state.audit.map((a) => a.entity))),
    [state.audit],
  );
  const rows = useMemo(
    () => state.audit.filter((a) => (entity === "all" ? true : a.entity === entity)),
    [state.audit, entity],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Auditoría"
        description="Bitácora inmutable de decisiones de originación, tesorería, KYC y configuración."
        actions={
          <NativeSelect value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="all">Todas las entidades</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Eventos" value={state.audit.length} />
        <StatCard label="Actores" value={new Set(state.audit.map((a) => a.actorId)).size} />
        <StatCard label="Último" value={formatDateTime(state.audit[0]?.at)} />
      </div>
      <DataTable
        rows={rows}
        pageSize={12}
        searchPlaceholder="Acción, detalle, operador…"
        searchFilter={(a, q) => {
          const op = findOperator(state, a.actorId);
          return `${a.action} ${a.detail} ${a.entityId} ${op?.name}`.toLowerCase().includes(q);
        }}
        columns={[
          { key: "at", header: "Fecha", render: (a) => formatDateTime(a.at) },
          { key: "op", header: "Actor", render: (a) => findOperator(state, a.actorId)?.name ?? a.actorId },
          { key: "act", header: "Acción", render: (a) => <span className="font-mono text-[12px]">{a.action}</span> },
          { key: "ent", header: "Entidad", render: (a) => `${a.entity} · ${a.entityId}` },
          { key: "d", header: "Detalle", render: (a) => <span className="text-[12.5px] text-slate-600">{a.detail}</span> },
        ]}
      />
    </div>
  );
}
