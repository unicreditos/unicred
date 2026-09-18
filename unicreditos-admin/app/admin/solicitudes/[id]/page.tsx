"use client";

import { LoanStatusBadge, KycBadge } from "@/components/admin/status-badge";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate, formatDateTime, formatDni } from "@/lib/format";
import { findClient, findMerchant, findOperator, findProduct } from "@/lib/lookups";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SolicitudDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, source } = useAdmin();
  const app = source.getApplication(id);
  const [comment, setComment] = useState("Califica según política de consumo AR.");
  const [open, setOpen] = useState(false);
  if (!app) {
    notFound();
  }
  const client = findClient(state, app.clientId)!;
  const product = findProduct(state, app.productId);
  const merchant = findMerchant(state, app.merchantId);
  const op = findOperator(state, app.operatorId);
  const approval = state.approvals.find((a) => a.applicationId === app.id);
  const kyc = state.kyc.find((k) => k.clientId === client.id);
  const credit = state.credits.find((c) => c.applicationId === app.id);
  const monthly = product ? product.tna / 100 / 12 : 0;
  const cuota = monthly
    ? Math.round((app.amount * monthly) / (1 - Math.pow(1 + monthly, -app.installments)))
    : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Solicitud"
        title={app.id}
        description={`${app.purpose} · alta ${formatDateTime(app.createdAt)}`}
        actions={
          <>
            <LoanStatusBadge status={app.status} />
            {app.status === "pending" ? (
              <Button variant="primary" onClick={() => setOpen(true)}>
                Decidir
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Monto" value={formatARS(app.amount)} />
        <StatCard label="Cuotas" value={app.installments} hint={`Cuota estimada ${formatARS(cuota)}`} />
        <StatCard label="Producto" value={product?.name ?? "—"} hint={product ? `TNA ${product.tna}% · CFT ${product.cft}%` : ""} />
        <StatCard label="Canal" value={merchant ? merchant.name : "Directo"} hint={merchant ? "Consumo comercio" : "Personal"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 space-y-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Expediente</p>
          <dl className="grid gap-3 sm:grid-cols-2 text-[13.5px]">
            <div>
              <dt className="text-muted">Cliente</dt>
              <dd className="font-semibold">
                <Link className="text-brand" href={`/admin/clientes/${client.id}`}>
                  {clientName(client)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted">DNI / CUIT</dt>
              <dd className="tabular">
                {formatDni(client.dni)} · {client.cuit}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Ingresos declarados</dt>
              <dd>{formatARS(client.declaredIncome)} / mes</dd>
            </div>
            <div>
              <dt className="text-muted">Relación cuota / ingreso</dt>
              <dd>{((cuota / client.declaredIncome) * 100).toFixed(1).replace(".", ",")}%</dd>
            </div>
            <div>
              <dt className="text-muted">CBU de acreditación</dt>
              <dd className="tabular text-[12.5px]">{client.cbu}</dd>
            </div>
            <div>
              <dt className="text-muted">Banco</dt>
              <dd>{client.bank}</dd>
            </div>
            <div>
              <dt className="text-muted">Analista</dt>
              <dd>{op?.name ?? "Sin asignar"}</dd>
            </div>
            <div>
              <dt className="text-muted">Decisión</dt>
              <dd>{formatDateTime(app.decidedAt)}</dd>
            </div>
          </dl>
          {app.notes ? (
            <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600">{app.notes}</p>
          ) : null}
          {credit ? (
            <p className="text-[13.5px]">
              Crédito generado:{" "}
              <Link className="font-semibold text-brand" href={`/admin/creditos/${credit.id}`}>
                {credit.id}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">KYC Didit</p>
            <div className="mt-2 flex items-center justify-between">
              <KycBadge status={client.kycStatus} />
              {kyc ? (
                <Link href="/admin/kyc" className="text-[12.5px] font-semibold text-brand">
                  {kyc.sessionId}
                </Link>
              ) : null}
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              Liveness {kyc?.liveness ? "OK" : "pendiente"} · match {kyc?.faceMatchScore ?? "—"}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Política</p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {(approval?.policyFlags.length ? approval.policyFlags : ["Sin flags"]).map((f) => (
                <li key={f} className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Decisión de originación">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => {
              source.rejectApplication({ applicationId: app.id, operatorId: CURRENT_OPERATOR_ID, comment });
              setOpen(false);
            }}
          >
            Rechazar
          </Button>
          <Button
            variant="success"
            onClick={() => {
              source.approveApplication({ applicationId: app.id, operatorId: CURRENT_OPERATOR_ID, comment });
              setOpen(false);
            }}
          >
            Calificar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
