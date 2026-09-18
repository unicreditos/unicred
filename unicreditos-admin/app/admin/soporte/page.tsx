"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatDateTime, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/format";
import { findClient, findOperator } from "@/lib/lookups";
import Link from "next/link";
import { useMemo, useState } from "react";

const stTone = {
  open: "info",
  pending: "pending",
  resolved: "active",
  closed: "cancelled",
} as const;
const prTone = {
  low: "cancelled",
  medium: "info",
  high: "pending",
  urgent: "rejected",
} as const;

export default function SoportePage() {
  const { state, source } = useAdmin();
  const [st, setSt] = useState("openish");
  const rows = useMemo(() => {
    if (st === "openish") return state.tickets.filter((t) => t.status === "open" || t.status === "pending");
    if (st === "all") return state.tickets;
    return state.tickets.filter((t) => t.status === st);
  }, [state.tickets, st]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Soporte"
        description="Mesa de ayuda a clientes y comercios. WhatsApp, email, teléfono e interno."
        actions={
          <NativeSelect value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="openish">Abiertos</option>
            <option value="all">Todos</option>
            <option value="resolved">Resueltos</option>
            <option value="closed">Cerrados</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Abiertos" value={state.tickets.filter((t) => t.status === "open").length} hintTone="info" />
        <StatCard label="En espera" value={state.tickets.filter((t) => t.status === "pending").length} hintTone="warn" />
        <StatCard label="Urgentes" value={state.tickets.filter((t) => t.priority === "urgent" && t.status !== "closed").length} hintTone="bad" />
        <StatCard label="Inbox" value={state.config.supportEmail} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Asunto, ticket, cliente…"
        searchFilter={(t, q) => {
          const c = t.clientId ? findClient(state, t.clientId) : undefined;
          return `${t.id} ${t.subject} ${c?.lastName}`.toLowerCase().includes(q);
        }}
        columns={[
          { key: "id", header: "Ticket", render: (t) => <span className="font-semibold">{t.id}</span> },
          { key: "sub", header: "Asunto", render: (t) => t.subject },
          {
            key: "cli",
            header: "Cliente",
            render: (t) => {
              if (!t.clientId) return <span className="text-muted">Interno / comercio</span>;
              const c = findClient(state, t.clientId);
              return c ? (
                <Link className="text-brand" href={`/admin/clientes/${c.id}`}>
                  {clientName(c)}
                </Link>
              ) : "—";
            },
          },
          { key: "ch", header: "Canal", render: (t) => t.channel },
          { key: "pr", header: "Prioridad", render: (t) => <Badge tone={prTone[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge> },
          { key: "as", header: "Asignado", render: (t) => findOperator(state, t.assigneeId)?.name ?? "—" },
          { key: "st", header: "Estado", render: (t) => <Badge tone={stTone[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge> },
          { key: "upd", header: "Actualizado", render: (t) => formatDateTime(t.updatedAt) },
          {
            key: "a",
            header: "",
            render: (t) =>
              t.status === "open" || t.status === "pending" ? (
                <Button size="sm" variant="success" onClick={() => source.resolveTicket(t.id, CURRENT_OPERATOR_ID)}>
                  Resolver
                </Button>
              ) : (
                <span className="text-[12px] text-muted">{t.messages} msgs</span>
              ),
          },
        ]}
      />
    </div>
  );
}
