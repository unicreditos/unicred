"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { ApprovalBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDateTime } from "@/lib/format";
import { findClient, findOperator } from "@/lib/lookups";
import type { Approval } from "@/lib/domain/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function AprobacionesPage() {
  const { state, source } = useAdmin();
  const [filter, setFilter] = useState("open");
  const [open, setOpen] = useState<Approval | null>(null);
  const [comment, setComment] = useState("Aprobado por política de consumo AR.");
  const rows = useMemo(() => {
    if (filter === "open") return state.approvals.filter((a) => a.decision === "pending" || a.decision === "observed");
    if (filter === "all") return state.approvals;
    return state.approvals.filter((a) => a.decision === filter);
  }, [state.approvals, filter]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Aprobaciones"
        description="Mesa de crédito. Calificación manual previa al desembolso."
        actions={
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">Pendientes y observadas</option>
            <option value="all">Todas</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Pendientes" value={state.approvals.filter((a) => a.decision === "pending").length} hintTone="warn" />
        <StatCard label="Observadas" value={state.approvals.filter((a) => a.decision === "observed").length} hint="Flags de política" />
        <StatCard label="Aprobadas" value={state.approvals.filter((a) => a.decision === "approved").length} hintTone="ok" />
        <StatCard label="Rechazadas" value={state.approvals.filter((a) => a.decision === "rejected").length} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Solicitud, cliente, flag…"
        searchFilter={(a, q) => {
          const c = findClient(state, a.clientId);
          return `${a.applicationId} ${c?.lastName} ${a.policyFlags.join(" ")}`.toLowerCase().includes(q);
        }}
        columns={[
          {
            key: "sol",
            header: "Solicitud",
            render: (a) => (
              <Link className="font-semibold text-brand" href={`/admin/solicitudes/${a.applicationId}`}>
                {a.applicationId}
              </Link>
            ),
          },
          {
            key: "cli",
            header: "Cliente",
            render: (a) => {
              const c = findClient(state, a.clientId);
              return c ? clientName(c) : "—";
            },
          },
          {
            key: "amt",
            header: "Monto",
            className: "tabular",
            render: (a) => formatARS(state.applications.find((x) => x.id === a.applicationId)?.amount ?? 0),
          },
          {
            key: "flags",
            header: "Flags",
            render: (a) =>
              a.policyFlags.length ? (
                <span className="text-[12.5px] text-amber-700">{a.policyFlags.join(" · ")}</span>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
          { key: "asig", header: "Asignado", render: (a) => findOperator(state, a.assignedTo)?.name ?? "—" },
          { key: "fecha", header: "Alta", render: (a) => formatDateTime(a.createdAt) },
          { key: "st", header: "Decisión", render: (a) => <ApprovalBadge decision={a.decision} /> },
          {
            key: "act",
            header: "",
            render: (a) =>
              a.decision === "pending" || a.decision === "observed" ? (
                <Button size="sm" variant="primary" onClick={() => setOpen(a)}>
                  Resolver
                </Button>
              ) : null,
          },
        ]}
      />
      <Dialog open={!!open} onClose={() => setOpen(null)} title="Mesa de crédito" description={open?.applicationId}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="danger" onClick={() => { if (!open) return; source.rejectApplication({ applicationId: open.applicationId, operatorId: CURRENT_OPERATOR_ID, comment }); setOpen(null); }}>Rechazar</Button>
          <Button variant="success" onClick={() => { if (!open) return; source.approveApplication({ applicationId: open.applicationId, operatorId: CURRENT_OPERATOR_ID, comment }); setOpen(null); }}>Calificar</Button>
        </div>
      </Dialog>
    </div>
  );
}
