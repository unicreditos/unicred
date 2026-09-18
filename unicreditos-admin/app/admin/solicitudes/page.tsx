"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { LoanStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate } from "@/lib/format";
import { findClient, findMerchant, findProduct } from "@/lib/lookups";
import type { LoanApplication } from "@/lib/domain/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function SolicitudesPage() {
  const { state, source } = useAdmin();
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<LoanApplication | null>(null);
  const [comment, setComment] = useState("Califica. Desembolso manual a CBU.");

  const rows = useMemo(
    () =>
      state.applications.filter((a) => (status === "all" ? true : a.status === status)),
    [state.applications, status],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Originación"
        title="Solicitudes"
        description="Crédito personal y consumo. Evaluación, calificación y rechazo — sin operatoria multi-país."
        actions={
          open ? null : (
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pending">En evaluación</option>
              <option value="approved">Calificado</option>
              <option value="rejected">Rechazado</option>
              <option value="cancelled">Anulado</option>
            </NativeSelect>
          )
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="En evaluación" value={state.applications.filter((a) => a.status === "pending").length} hint="Cola de originación" hintTone="warn" />
        <StatCard label="Calificadas" value={state.applications.filter((a) => a.status === "approved").length} hint="Listas para desembolso" hintTone="ok" />
        <StatCard label="Rechazadas" value={state.applications.filter((a) => a.status === "rejected").length} hint="Capacidad / KYC / CENDEU" />
        <StatCard label="Monto en cola" value={formatARS(state.applications.filter((a) => a.status === "pending").reduce((a, x) => a + x.amount, 0))} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Buscar por ID, cliente o propósito…"
        searchFilter={(a, q) => {
          const c = findClient(state, a.clientId);
          return `${a.id} ${a.purpose} ${c?.firstName} ${c?.lastName} ${c?.dni}`.toLowerCase().includes(q);
        }}
        onRowClick={(a) => router.push(`/admin/solicitudes/${a.id}`)}
        columns={[
          { key: "id", header: "Solicitud", render: (a) => <span className="font-semibold text-brand">{a.id}</span> },
          {
            key: "cli",
            header: "Cliente",
            render: (a) => {
              const c = findClient(state, a.clientId);
              return c ? (
                <div>
                  <p className="font-medium">{clientName(c)}</p>
                  <p className="text-[12px] text-muted">DNI {c.dni}</p>
                </div>
              ) : (
                "—"
              );
            },
          },
          { key: "prd", header: "Producto", render: (a) => findProduct(state, a.productId)?.name },
          {
            key: "m",
            header: "Comercio",
            render: (a) => findMerchant(state, a.merchantId)?.name ?? "— personal",
          },
          { key: "amt", header: "Monto", className: "tabular", render: (a) => formatARS(a.amount) },
          { key: "cuotas", header: "Cuotas", render: (a) => a.installments },
          { key: "fecha", header: "Alta", render: (a) => formatDate(a.createdAt) },
          { key: "st", header: "Estado", render: (a) => <LoanStatusBadge status={a.status} /> },
          {
            key: "act",
            header: "",
            render: (a) =>
              a.status === "pending" ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(a);
                  }}
                >
                  Decidir
                </Button>
              ) : null,
          },
        ]}
      />
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Decidir ${open.id}` : ""}
        description="La calificación genera el crédito y deja el desembolso en cola manual."
      >
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!open) return;
              source.rejectApplication({ applicationId: open.id, operatorId: CURRENT_OPERATOR_ID, comment });
              setOpen(null);
            }}
          >
            Rechazar
          </Button>
          <Button
            variant="success"
            onClick={() => {
              if (!open) return;
              source.approveApplication({ applicationId: open.id, operatorId: CURRENT_OPERATOR_ID, comment });
              setOpen(null);
            }}
          >
            Calificar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
