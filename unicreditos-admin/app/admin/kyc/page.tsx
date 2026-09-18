"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { KycBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatDateTime } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import type { KycCase } from "@/lib/domain/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function KycPage() {
  const { state, source } = useAdmin();
  const [status, setStatus] = useState("queue");
  const [open, setOpen] = useState<KycCase | null>(null);
  const [notes, setNotes] = useState("");
  const rows = useMemo(() => {
    if (status === "queue") return state.kyc.filter((k) => k.status === "pending" || k.status === "in_review");
    if (status === "all") return state.kyc;
    return state.kyc.filter((k) => k.status === status);
  }, [state.kyc, status]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Originación"
        title="Identidad / KYC"
        description="Verificación Didit: documento, liveness y face match. Sin onboarding multi-país."
        actions={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="queue">Cola operativa</option>
            <option value="all">Todos</option>
            <option value="verified">Verificados</option>
            <option value="rejected">Rechazados</option>
            <option value="expired">Vencidos</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Pendientes" value={state.kyc.filter((k) => k.status === "pending").length} hintTone="warn" />
        <StatCard label="En revisión" value={state.kyc.filter((k) => k.status === "in_review").length} hint="Liveness OK, DNI a validar" />
        <StatCard label="Verificados" value={state.kyc.filter((k) => k.status === "verified").length} hintTone="ok" />
        <StatCard label="Proveedor" value="Didit" hint="Sesiones 24 h" />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Cliente, sesión Didit…"
        searchFilter={(k, q) => {
          const c = findClient(state, k.clientId);
          return `${k.sessionId} ${c?.firstName} ${c?.lastName} ${c?.dni}`.toLowerCase().includes(q);
        }}
        columns={[
          { key: "sid", header: "Sesión Didit", render: (k) => <span className="font-mono text-[12.5px]">{k.sessionId}</span> },
          {
            key: "cli",
            header: "Cliente",
            render: (k) => {
              const c = findClient(state, k.clientId);
              return c ? (
                <Link className="font-medium text-brand" href={`/admin/clientes/${c.id}`}>
                  {clientName(c)}
                </Link>
              ) : "—";
            },
          },
          { key: "doc", header: "Documento", render: (k) => k.documentType.toUpperCase() },
          { key: "live", header: "Liveness", render: (k) => (k.liveness ? "OK" : "No") },
          { key: "face", header: "Face match", render: (k) => (k.faceMatchScore == null ? "—" : `${k.faceMatchScore}%`) },
          { key: "start", header: "Inicio", render: (k) => formatDateTime(k.startedAt) },
          { key: "st", header: "Estado", render: (k) => <KycBadge status={k.status} /> },
          {
            key: "a",
            header: "",
            render: (k) =>
              k.status === "pending" || k.status === "in_review" ? (
                <Button size="sm" variant="primary" onClick={() => { setOpen(k); setNotes(k.notes); }}>
                  Resolver
                </Button>
              ) : null,
          },
        ]}
      />
      <Dialog open={!!open} onClose={() => setOpen(null)} title="Resolver KYC Didit" description={open?.sessionId}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas de validación" />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="danger" onClick={() => { if (!open) return; source.decideKyc({ kycId: open.id, operatorId: CURRENT_OPERATOR_ID, status: "rejected", notes }); setOpen(null); }}>Rechazar</Button>
          <Button variant="success" onClick={() => { if (!open) return; source.decideKyc({ kycId: open.id, operatorId: CURRENT_OPERATOR_ID, status: "verified", notes: notes || "Didit OK" }); setOpen(null); }}>Verificar</Button>
        </div>
      </Dialog>
    </div>
  );
}
