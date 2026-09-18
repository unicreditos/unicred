"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { DisbursementBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatCbu, formatDateTime } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import type { Disbursement } from "@/lib/domain/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function DesembolsosPage() {
  const { state, source } = useAdmin();
  const [st, setSt] = useState("queue");
  const [open, setOpen] = useState<Disbursement | null>(null);
  const [ref, setRef] = useState("");
  const rows = useMemo(() => {
    if (st === "queue") return state.disbursements.filter((d) => d.status === "queued" || d.status === "processing");
    if (st === "all") return state.disbursements;
    return state.disbursements.filter((d) => d.status === st);
  }, [state.disbursements, st]);
  const queuedAmt = state.disbursements
    .filter((d) => d.status === "queued" || d.status === "processing")
    .reduce((a, d) => a + d.amount, 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Desembolsos"
        description="Acreditación 100% manual a CBU. No hay liquidación automática ni punitivos."
        actions={
          <NativeSelect value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="queue">En cola</option>
            <option value="all">Todos</option>
            <option value="completed">Acreditados</option>
            <option value="failed">Fallidos</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="En cola" value={state.disbursements.filter((d) => d.status === "queued").length} hintTone="warn" />
        <StatCard label="A acreditar" value={formatARS(queuedAmt)} hint="Cuenta Nación Desembolsos" />
        <StatCard label="Acreditados" value={state.disbursements.filter((d) => d.status === "completed").length} hintTone="ok" />
        <StatCard label="Fallidos" value={state.disbursements.filter((d) => d.status === "failed").length} hintTone="bad" />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Cliente, CBU, crédito…"
        searchFilter={(d, q) => {
          const c = findClient(state, d.clientId);
          return `${d.id} ${d.creditId} ${d.cbu} ${c?.lastName} ${d.reference}`.toLowerCase().includes(q);
        }}
        columns={[
          { key: "id", header: "Lote", render: (d) => <span className="font-semibold">{d.id}</span> },
          {
            key: "cr",
            header: "Crédito",
            render: (d) => (
              <Link className="text-brand" href={`/admin/creditos/${d.creditId}`}>
                {d.creditId}
              </Link>
            ),
          },
          {
            key: "cli",
            header: "Beneficiario",
            render: (d) => {
              const c = findClient(state, d.clientId);
              return c ? clientName(c) : "—";
            },
          },
          { key: "amt", header: "Importe", className: "tabular", render: (d) => formatARS(d.amount) },
          { key: "bank", header: "Banco", render: (d) => d.bank },
          { key: "cbu", header: "CBU", className: "tabular text-[12px]", render: (d) => formatCbu(d.cbu) },
          { key: "req", header: "Pedido", render: (d) => formatDateTime(d.requestedAt) },
          { key: "st", header: "Estado", render: (d) => <DisbursementBadge status={d.status} /> },
          {
            key: "a",
            header: "",
            render: (d) =>
              d.status === "queued" || d.status === "processing" ? (
                <Button size="sm" variant="success" onClick={() => { setOpen(d); setRef(`TRX-UC-${Date.now() % 100000}`); }}>
                  Marcar acreditado
                </Button>
              ) : (
                <span className="text-[12px] text-muted">{d.reference}</span>
              ),
          },
        ]}
      />
      <Dialog open={!!open} onClose={() => setOpen(null)} title="Confirmar acreditación" description="Registrá la referencia del banco o homebanking.">
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TRX-…" />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setOpen(null)}>Cancelar</Button>
          <Button variant="success" onClick={() => { if (!open) return; source.markDisbursed({ disbursementId: open.id, operatorId: CURRENT_OPERATOR_ID, reference: ref }); setOpen(null); }}>
            Confirmar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
