"use client";

import { BucketBadge, LoanStatusBadge } from "@/components/admin/status-badge";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate, PAYMENT_CHANNEL_LABEL } from "@/lib/format";
import { findClient, findMerchant, findProduct } from "@/lib/lookups";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";

export default function CreditoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, source } = useAdmin();
  const credit = source.getCredit(id);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"mercadopago" | "transferencia">("mercadopago");
  const [amount, setAmount] = useState("");
  if (!credit) notFound();
  const client = findClient(state, credit.clientId)!;
  const product = findProduct(state, credit.productId);
  const merchant = findMerchant(state, credit.merchantId);
  const pays = state.payments.filter((p) => p.creditId === credit.id);
  const disb = state.disbursements.find((d) => d.creditId === credit.id);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Crédito"
        title={credit.id}
        description={`${product?.name ?? ""} · ${clientName(client)}`}
        actions={
          <>
            <LoanStatusBadge status={credit.status} />
            {credit.status === "active" ? (
              <Button variant="primary" onClick={() => setOpen(true)}>
                Registrar cobro
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Capital" value={formatARS(credit.amount)} />
        <StatCard label="Saldo" value={formatARS(credit.principalOutstanding)} hintTone="info" />
        <StatCard label="Cuota" value={formatARS(credit.installmentAmount)} hint={`${credit.installments} cuotas · TNA ${credit.tna}%`} />
        <StatCard label="Mora" value={`${credit.daysPastDue} días`} hint={<BucketBadge bucket={credit.bucket} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <p className="font-semibold">Cronograma</p>
            <p className="text-[12.5px] text-muted">Sin interés punitivo. La mora no recarga la cuota.</p>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Vencimiento</th>
                <th className="px-4 py-2">Cuota</th>
                <th className="px-4 py-2">Pagado</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {credit.schedule.map((s) => (
                <tr key={s.number} className="border-t border-line">
                  <td className="px-4 py-2 tabular">{s.number}</td>
                  <td className="px-4 py-2">{formatDate(s.dueDate)}</td>
                  <td className="px-4 py-2 tabular">{formatARS(s.amount)}</td>
                  <td className="px-4 py-2 tabular">{s.paidAmount ? formatARS(s.paidAmount) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className="text-[12.5px] font-semibold capitalize text-slate-600">
                      {s.status === "paid" ? "Pagada" : s.status === "overdue" ? "Vencida" : s.status === "partial" ? "Parcial" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="card p-4 text-[13.5px] space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Contrato</p>
            <p>
              Cliente{" "}
              <Link className="font-semibold text-brand" href={`/admin/clientes/${client.id}`}>
                {clientName(client)}
              </Link>
            </p>
            <p>TEA {credit.tea}% · CFT {credit.cft}%</p>
            <p>Desembolso {formatDate(credit.disbursedAt)}</p>
            {disb ? (
              <p>
                Tesorería{" "}
                <Link className="text-brand" href="/admin/desembolsos">
                  {disb.id}
                </Link>
              </p>
            ) : null}
            {merchant ? (
              <p>
                Comercio{" "}
                <Link className="text-brand" href={`/admin/comercios/${merchant.id}`}>
                  {merchant.name}
                </Link>
              </p>
            ) : null}
            <p>
              Solicitud{" "}
              <Link className="text-brand" href={`/admin/solicitudes/${credit.applicationId}`}>
                {credit.applicationId}
              </Link>
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Pagos</p>
            <ul className="mt-2 space-y-2 text-[13px]">
              {pays.length === 0 ? <li className="text-muted">Sin cobros registrados</li> : null}
              {pays.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between">
                  <Link href={`/admin/pagos/${p.id}`} className="text-brand">
                    {PAYMENT_CHANNEL_LABEL[p.channel]}
                  </Link>
                  <span className="tabular">{formatARS(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar cobro">
        <div className="space-y-3">
          <NativeSelect value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="mercadopago">MercadoPago</option>
            <option value="transferencia">Transferencia CBU</option>
          </NativeSelect>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(credit.installmentAmount)}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                source.registerPayment({
                  creditId: credit.id,
                  amount: Number(amount) || credit.installmentAmount,
                  channel,
                  operatorId: CURRENT_OPERATOR_ID,
                });
                setOpen(false);
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
