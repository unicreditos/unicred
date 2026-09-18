"use client";

import { MerchantBadge, LoanStatusBadge } from "@/components/admin/status-badge";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate, formatPct } from "@/lib/format";
import { findClient } from "@/lib/lookups";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

export default function ComercioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, source } = useAdmin();
  const merchant = source.getMerchant(id);
  if (!merchant) notFound();
  const apps = state.applications.filter((a) => a.merchantId === merchant.id);
  const credits = state.credits.filter((c) => c.merchantId === merchant.id);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Comercio"
        title={merchant.name}
        description={`${merchant.category} · ${merchant.city}, ${merchant.province}`}
        actions={
          <>
            <MerchantBadge status={merchant.status} />
            {merchant.status === "active" ? (
              <Button variant="secondary" onClick={() => source.pauseMerchant(merchant.id, CURRENT_OPERATOR_ID)}>
                Pausar
              </Button>
            ) : merchant.status === "paused" || merchant.status === "onboarding" ? (
              <Button variant="success" onClick={() => source.activateMerchant(merchant.id, CURRENT_OPERATOR_ID)}>
                Activar
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Volumen" value={formatARS(merchant.volume)} />
        <StatCard label="Originaciones" value={merchant.originations} />
        <StatCard label="Comisión" value={formatPct(merchant.commissionPct)} />
        <StatCard label="Alta" value={formatDate(merchant.onboardedAt)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 text-[13.5px] space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Datos fiscales</p>
          <p>CUIT {merchant.cuit}</p>
          <p>Contacto {merchant.contact} · {merchant.email}</p>
          <p>{merchant.phone}</p>
          <p className="text-muted">
            El desembolso de consumo se acredita al CBU del comercio, no al cliente. Comisión descontada del capital.
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">En pipeline</p>
          <p className="mt-2 text-[22px] font-semibold">{apps.filter((a) => a.status === "pending").length}</p>
          <p className="text-[12.5px] text-muted">solicitudes en evaluación</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">Operaciones recientes</div>
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase text-slate-400">
              <th className="px-4 py-2">Solicitud</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Monto</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => {
              const c = findClient(state, a.clientId);
              return (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link className="font-semibold text-brand" href={`/admin/solicitudes/${a.id}`}>{a.id}</Link>
                  </td>
                  <td className="px-4 py-2">{c ? clientName(c) : "—"}</td>
                  <td className="px-4 py-2 tabular">{formatARS(a.amount)}</td>
                  <td className="px-4 py-2"><LoanStatusBadge status={a.status} /></td>
                </tr>
              );
            })}
            {apps.length === 0 ? (
              <tr><td className="px-4 py-8 text-muted" colSpan={4}>Sin operaciones en el recorte mock.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-muted">{credits.length} créditos asociados a este comercio.</p>
    </div>
  );
}
