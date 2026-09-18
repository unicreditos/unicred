"use client";

import { KycBadge, LoanStatusBadge } from "@/components/admin/status-badge";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { useAdmin } from "@/lib/data/client";
import { CENDEU_LABEL, clientName, formatARS, formatCbu, formatDate, formatDni } from "@/lib/format";
import { findProduct } from "@/lib/lookups";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, source } = useAdmin();
  const client = source.getClient(id);
  if (!client) notFound();
  const apps = state.applications.filter((a) => a.clientId === client.id);
  const credits = state.credits.filter((c) => c.clientId === client.id);
  const kyc = state.kyc.filter((k) => k.clientId === client.id);
  const cendeu = state.cendeu.find((r) => r.clientId === client.id);
  const tickets = state.tickets.filter((t) => t.clientId === client.id);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Cliente"
        title={clientName(client)}
        description={`${client.occupation} · ${client.employer} · ${client.address.city}`}
        actions={<KycBadge status={client.kycStatus} />}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Ingresos" value={formatARS(client.declaredIncome)} />
        <StatCard label="Score interno" value={client.score} />
        <StatCard label="Solicitudes" value={apps.length} />
        <StatCard label="Créditos" value={credits.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Identidad</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-[13.5px]">
            <div>
              <dt className="text-muted">DNI</dt>
              <dd className="tabular font-medium">{formatDni(client.dni)}</dd>
            </div>
            <div>
              <dt className="text-muted">CUIT</dt>
              <dd className="tabular">{client.cuit}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{client.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Teléfono</dt>
              <dd>{client.phone}</dd>
            </div>
            <div>
              <dt className="text-muted">Domicilio</dt>
              <dd>
                {client.address.street}, {client.address.city} ({client.address.postalCode})
              </dd>
            </div>
            <div>
              <dt className="text-muted">Alta</dt>
              <dd>{formatDate(client.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">CBU · {client.bank}</dt>
              <dd className="tabular text-[12.5px]">{formatCbu(client.cbu)}</dd>
            </div>
          </dl>
        </div>
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">CENDEU</p>
            {cendeu ? (
              <>
                <p className="mt-2 font-semibold">{CENDEU_LABEL[cendeu.result]}</p>
                <p className="text-[12.5px] text-muted">{cendeu.observations}</p>
                <Link href="/admin/riesgo" className="mt-2 inline-block text-[12.5px] font-semibold text-brand">
                  Ver informe
                </Link>
              </>
            ) : (
              <p className="mt-2 text-muted text-[13px]">Sin consulta</p>
            )}
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Didit</p>
            {kyc.map((k) => (
              <p key={k.id} className="mt-2 text-[13px]">
                {k.sessionId} · {k.documentType.toUpperCase()}
              </p>
            ))}
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">Créditos y solicitudes</div>
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase text-slate-400">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Monto</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link className="font-semibold text-brand" href={`/admin/solicitudes/${a.id}`}>
                    {a.id}
                  </Link>
                </td>
                <td className="px-4 py-2">Solicitud</td>
                <td className="px-4 py-2">{findProduct(state, a.productId)?.name}</td>
                <td className="px-4 py-2 tabular">{formatARS(a.amount)}</td>
                <td className="px-4 py-2">
                  <LoanStatusBadge status={a.status} />
                </td>
              </tr>
            ))}
            {credits.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link className="font-semibold text-brand" href={`/admin/creditos/${c.id}`}>
                    {c.id}
                  </Link>
                </td>
                <td className="px-4 py-2">Crédito</td>
                <td className="px-4 py-2">{findProduct(state, c.productId)?.name}</td>
                <td className="px-4 py-2 tabular">{formatARS(c.amount)}</td>
                <td className="px-4 py-2">
                  <LoanStatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tickets.length > 0 ? (
        <p className="text-[13px] text-muted">
          Tickets de soporte: {tickets.map((t) => t.id).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
