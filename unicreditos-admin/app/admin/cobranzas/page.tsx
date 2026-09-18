"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { BucketBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDateTime } from "@/lib/format";
import { findClient, findCredit } from "@/lib/lookups";
import type { CollectionCase } from "@/lib/domain/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function CobranzasPage() {
  const { state, source } = useAdmin();
  const [bucket, setBucket] = useState("all");
  const [open, setOpen] = useState<CollectionCase | null>(null);
  const [note, setNote] = useState("WhatsApp de recordatorio enviado.");
  const rows = useMemo(
    () => state.collections.filter((c) => (bucket === "all" ? true : c.bucket === bucket)),
    [state.collections, bucket],
  );
  const overdue = state.collections.reduce((a, c) => a + c.overdueAmount, 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Cobranzas"
        description="Gestión de cuotas vencidas. No se aplican intereses punitivos ni recargos por mora."
        actions={
          <NativeSelect value={bucket} onChange={(e) => setBucket(e.target.value)}>
            <option value="all">Todos los buckets</option>
            <option value="1_30">1–30 días</option>
            <option value="31_60">31–60</option>
            <option value="61_90">61–90</option>
            <option value="90_plus">90+</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Casos" value={state.collections.length} hintTone="warn" />
        <StatCard label="Deuda vencida" value={formatARS(overdue)} hintTone="bad" />
        <StatCard label="SLA contacto" value={`${state.config.collectionsSlaHours} h`} />
        <StatCard label="90+" value={state.collections.filter((c) => c.bucket === "90_plus").length} hint="Candidatos a refinanciación" />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Cliente, crédito…"
        searchFilter={(c, q) => {
          const cl = findClient(state, c.clientId);
          return `${c.creditId} ${cl?.lastName} ${cl?.dni}`.toLowerCase().includes(q);
        }}
        columns={[
          {
            key: "cr",
            header: "Crédito",
            render: (c) => (
              <Link className="font-semibold text-brand" href={`/admin/creditos/${c.creditId}`}>
                {c.creditId}
              </Link>
            ),
          },
          {
            key: "cli",
            header: "Cliente",
            render: (c) => {
              const cl = findClient(state, c.clientId);
              return cl ? clientName(cl) : "—";
            },
          },
          { key: "bk", header: "Bucket", render: (c) => <BucketBadge bucket={c.bucket} /> },
          { key: "dpd", header: "Días", className: "tabular", render: (c) => c.daysPastDue },
          { key: "amt", header: "Vencido", className: "tabular", render: (c) => formatARS(c.overdueAmount) },
          { key: "last", header: "Último contacto", render: (c) => formatDateTime(c.lastContactAt) },
          { key: "next", header: "Próxima acción", render: (c) => c.nextAction },
          {
            key: "cuota",
            header: "Cuota",
            className: "tabular",
            render: (c) => formatARS(findCredit(state, c.creditId)?.installmentAmount ?? 0),
          },
          {
            key: "a",
            header: "",
            render: (c) => (
              <Button size="sm" onClick={() => setOpen(c)}>
                Registrar gestión
              </Button>
            ),
          },
        ]}
      />
      <Dialog open={!!open} onClose={() => setOpen(null)} title="Registrar gestión de cobro">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setOpen(null)}>Cancelar</Button>
          <Button variant="primary" onClick={() => { if (!open) return; source.logCollectionContact(open.id, CURRENT_OPERATOR_ID, note); setOpen(null); }}>
            Guardar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
