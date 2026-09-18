"use client";

import { DataTable } from "@/components/admin/data-table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { KycBadge } from "@/components/admin/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { clientName, formatARS, formatDate, formatDni } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function ClientesPage() {
  const { state } = useAdmin();
  const router = useRouter();
  const [kyc, setKyc] = useState("all");
  const rows = useMemo(
    () => state.clients.filter((c) => (kyc === "all" ? true : c.kycStatus === kyc)),
    [state.clients, kyc],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Originación"
        title="Clientes"
        description="Personas humanas en Argentina. Identidad Didit, CBU y capacidad de pago."
        actions={
          <NativeSelect value={kyc} onChange={(e) => setKyc(e.target.value)}>
            <option value="all">KYC todos</option>
            <option value="verified">Verificado</option>
            <option value="in_review">En revisión</option>
            <option value="pending">Pendiente</option>
            <option value="rejected">Rechazado</option>
            <option value="expired">Vencido</option>
          </NativeSelect>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Clientes" value={state.clients.length} />
        <StatCard label="KYC verificado" value={state.clients.filter((c) => c.kycStatus === "verified").length} hintTone="ok" />
        <StatCard label="Ingreso medio" value={formatARS(Math.round(state.clients.reduce((a, c) => a + c.declaredIncome, 0) / state.clients.length))} />
        <StatCard label="Score medio" value={Math.round(state.clients.reduce((a, c) => a + c.score, 0) / state.clients.length)} />
      </div>
      <DataTable
        rows={rows}
        searchPlaceholder="Nombre, DNI, CUIT, email…"
        searchFilter={(c, q) =>
          `${c.firstName} ${c.lastName} ${c.dni} ${c.cuit} ${c.email} ${c.id}`.toLowerCase().includes(q)
        }
        onRowClick={(c) => router.push(`/admin/clientes/${c.id}`)}
        columns={[
          {
            key: "n",
            header: "Cliente",
            render: (c) => (
              <div>
                <p className="font-semibold">{clientName(c)}</p>
                <p className="text-[12px] text-muted">{c.id}</p>
              </div>
            ),
          },
          { key: "dni", header: "DNI", className: "tabular", render: (c) => formatDni(c.dni) },
          { key: "mail", header: "Contacto", render: (c) => (
            <div>
              <p>{c.email}</p>
              <p className="text-[12px] text-muted">{c.phone}</p>
            </div>
          ) },
          { key: "city", header: "Ciudad", render: (c) => `${c.address.city}, ${c.address.province}` },
          { key: "inc", header: "Ingresos", className: "tabular", render: (c) => formatARS(c.declaredIncome) },
          { key: "sc", header: "Score", className: "tabular", render: (c) => c.score },
          { key: "kyc", header: "KYC", render: (c) => <KycBadge status={c.kycStatus} /> },
          { key: "alta", header: "Alta", render: (c) => formatDate(c.createdAt) },
        ]}
      />
    </div>
  );
}
