"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { PaymentBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDateTime, PAYMENT_CHANNEL_LABEL } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function PagosPage() {
  const { state, source } = useAdmin();
  const router = useRouter();
  const [ch, setCh] = useState("all");
  const rows = useMemo(() => {
    let r = state.payments;
    if (ch === "review") r = r.filter((p) => p.channel === "transferencia" && p.status === "pending");
    else if (ch !== "all") r = r.filter((p) => p.channel === ch);
    return r;
  }, [state.payments, ch]);
  const reconciled = state.payments.filter((p) => p.status === "reconciled");

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Pagos"
        description="MercadoPago (match automático) y transferencias CBU a conciliar."
        actions={
          <NativeSelect value={ch} onChange={(e) => setCh(e.target.value)}>
            <option value="all">Todos</option>
            <option value="review">Transferencias a revisar</option>
            <option value="mercadopago">MercadoPago</option>
            <option value="transferencia">Transferencias</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="A revisar" value={state.payments.filter((p) => p.status === "pending").length} hintTone="warn" hint="Conciliación bancaria" />
        <StatCard label="Conciliados" value={reconciled.length} hintTone="ok" />
        <StatCard label="Volumen conciliado" value={formatARS(reconciled.reduce((a, p) => a + p.amount, 0))} />
        <StatCard label="Collector MP" value={state.config.mpCollectorId} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="ID, referencia, cliente…"
        searchFilter={(p, q) => {
          const c = findClient(state, p.clientId);
          return `${p.id} ${p.transferRef} ${p.mpPaymentId} ${c?.lastName}`.toLowerCase().includes(q);
        }}
        onRowClick={(p) => router.push(`/admin/pagos/${p.id}`)}
        columns={[
          { key: "id", header: "Pago", render: (p) => <span className="font-mono text-[12.5px] text-brand">{p.id}</span> },
          {
            key: "cli",
            header: "Cliente",
            render: (p) => {
              const c = findClient(state, p.clientId);
              return c ? clientName(c) : "—";
            },
          },
          { key: "ch", header: "Canal", render: (p) => PAYMENT_CHANNEL_LABEL[p.channel] },
          { key: "amt", header: "Importe", className: "tabular", render: (p) => formatARS(p.amount) },
          { key: "ref", header: "Referencia", render: (p) => p.mpPaymentId ?? p.transferRef ?? "—" },
          { key: "fecha", header: "Fecha", render: (p) => formatDateTime(p.paidAt) },
          { key: "st", header: "Estado", render: (p) => <PaymentBadge status={p.status} /> },
          {
            key: "a",
            header: "",
            render: (p) =>
              p.status === "pending" && p.channel === "transferencia" ? (
                <Button
                  size="sm"
                  variant="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    source.matchTransfer({ paymentId: p.id, operatorId: CURRENT_OPERATOR_ID });
                  }}
                >
                  Matchear
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
