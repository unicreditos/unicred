"use client";

import { PaymentBadge } from "@/components/admin/status-badge";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatCbu, formatDateTime, PAYMENT_CHANNEL_LABEL } from "@/lib/format";
import { findClient, findCredit, findOperator } from "@/lib/lookups";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";

export default function PagoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, source } = useAdmin();
  const pay = source.getPayment(id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("No coincide titular / importe.");
  if (!pay) notFound();
  const client = findClient(state, pay.clientId)!;
  const credit = findCredit(state, pay.creditId);
  const matcher = findOperator(state, pay.matchedBy);
  const receipt = state.receipts.find((r) => r.paymentId === pay.id);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Pago"
        title={pay.id}
        description={`${PAYMENT_CHANNEL_LABEL[pay.channel]} · ${formatDateTime(pay.paidAt)}`}
        actions={
          <>
            <PaymentBadge status={pay.status} />
            {pay.status === "pending" ? (
              <>
                <Button variant="success" onClick={() => source.matchTransfer({ paymentId: pay.id, operatorId: CURRENT_OPERATOR_ID })}>
                  Conciliar
                </Button>
                <Button variant="danger" onClick={() => setOpen(true)}>
                  Rechazar
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Importe" value={formatARS(pay.amount)} />
        <StatCard label="Canal" value={PAYMENT_CHANNEL_LABEL[pay.channel]} />
        <StatCard label="Referencia" value={pay.mpPaymentId ?? pay.transferRef ?? "—"} />
        <StatCard label="Match" value={matcher?.name ?? "Automático / pendiente"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 text-[13.5px] space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Cliente</p>
          <p>
            <Link className="font-semibold text-brand" href={`/admin/clientes/${client.id}`}>
              {clientName(client)}
            </Link>
          </p>
          <p>CBU informado {formatCbu(client.cbu)}</p>
          {pay.transferCbu ? <p>CBU origen {formatCbu(pay.transferCbu)}</p> : null}
          <p className="text-muted">{pay.notes || "Sin observaciones"}</p>
        </div>
        <div className="card p-5 text-[13.5px] space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Aplicación</p>
          {credit ? (
            <>
              <p>
                Crédito{" "}
                <Link className="font-semibold text-brand" href={`/admin/creditos/${credit.id}`}>
                  {credit.id}
                </Link>
              </p>
              <p>Cuota pactada {formatARS(credit.installmentAmount)}</p>
            </>
          ) : null}
          {receipt ? (
            <p>
              Comprobante{" "}
              <Link className="text-brand" href="/admin/comprobantes">
                {receipt.number}
              </Link>
            </p>
          ) : (
            <p className="text-muted">El comprobante se emite al conciliar.</p>
          )}
        </div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Rechazar transferencia">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { source.rejectTransfer(pay.id, CURRENT_OPERATOR_ID, reason); setOpen(false); }}>
            Rechazar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
