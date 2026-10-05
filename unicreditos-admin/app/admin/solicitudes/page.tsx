"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { LoanStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate } from "@/lib/format";
import { findClient, findMerchant, findProduct } from "@/lib/lookups";
import type { LoanApplication } from "@/lib/domain/types";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function SolicitudesPage() {
  const { state, source } = useAdmin();
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<LoanApplication | null>(null);
  const [comment, setComment] = useState("Califica. Desembolso manual a CBU.");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const clients = state.clients;
  const products = state.products.filter((p) => p.active);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId) ?? products[0];
  const [amount, setAmount] = useState(product ? String(product.minAmount) : "");
  const [installments, setInstallments] = useState(product ? String(product.minInstallments) : "12");
  const [purpose, setPurpose] = useState("Crédito personal");
  const [merchantId, setMerchantId] = useState("");

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
          <>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pending">En evaluación</option>
              <option value="approved">Calificado</option>
              <option value="rejected">Rechazado</option>
              <option value="cancelled">Anulado</option>
            </NativeSelect>
            <Button variant="primary" onClick={() => { setFormError(null); setCreating(true); }}>
              <Plus className="h-4 w-4" /> Nueva solicitud
            </Button>
          </>
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
        emptyTitle="No hay solicitudes"
        emptyDescription="Cuando un cliente pide un crédito, o lo cargás desde acá, aparece en esta cola para calificar o rechazar."
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
        open={creating}
        onClose={() => { if (!saving) setCreating(false); }}
        title="Nueva solicitud"
        description="Queda en evaluación. Calificarla genera el crédito y deja el desembolso en cola manual."
      >
        <div className="space-y-3">
          <label className="block text-[12.5px] font-medium text-slate-600">
            Cliente
            <NativeSelect className="mt-1 w-full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.length === 0 ? <option value="">Sin clientes</option> : null}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientName(c)} · DNI {c.dni}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block text-[12.5px] font-medium text-slate-600">
            Producto
            <NativeSelect
              className="mt-1 w-full"
              value={productId}
              onChange={(e) => {
                const next = products.find((p) => p.id === e.target.value);
                setProductId(e.target.value);
                if (next) {
                  setAmount(String(next.minAmount));
                  setInstallments(String(next.minInstallments));
                }
              }}
            >
              {products.length === 0 ? <option value="">Sin productos activos</option> : null}
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12.5px] font-medium text-slate-600">
              Monto
              <Input className="mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {product ? (
                <span className="mt-1 block text-[11px] font-normal text-muted">
                  {formatARS(product.minAmount)} a {formatARS(product.maxAmount)}
                </span>
              ) : null}
            </label>
            <label className="block text-[12.5px] font-medium text-slate-600">
              Cuotas
              <Input className="mt-1" inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} />
              {product ? (
                <span className="mt-1 block text-[11px] font-normal text-muted">
                  {product.minInstallments} a {product.maxInstallments}
                </span>
              ) : null}
            </label>
          </div>
          <label className="block text-[12.5px] font-medium text-slate-600">
            Comercio
            <NativeSelect className="mt-1 w-full" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
              <option value="">Personal, sin comercio</option>
              {state.merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </NativeSelect>
          </label>
          <label className="block text-[12.5px] font-medium text-slate-600">
            Destino
            <Textarea className="mt-1" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
          {formError ? <p className="text-[13px] text-rose-600">{formError}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={saving || !clientId || !productId}
            onClick={() => {
              setSaving(true);
              setFormError(null);
              void source
                .createApplication({
                  clientId,
                  productId,
                  merchantId: merchantId || null,
                  amount: Number(String(amount).replace(/\s/g, "").replace(",", ".")),
                  installments: Number(installments),
                  purpose: purpose.trim() || "Crédito personal",
                })
                .then(() => {
                  setCreating(false);
                  setStatus("pending");
                })
                .catch((err: unknown) => {
                  setFormError(err instanceof Error ? err.message : "No se pudo crear la solicitud");
                })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Guardando…" : "Crear solicitud"}
          </Button>
        </div>
      </Dialog>
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
