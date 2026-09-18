"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/data/client";
import { formatARS, formatDate } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function FinanzasPage() {
  const { state } = useAdmin();
  const ingresos = state.ledger.filter((l) => l.type === "ingreso").reduce((a, l) => a + l.amount, 0);
  const egresos = state.ledger.filter((l) => l.type === "egreso").reduce((a, l) => a + l.amount, 0);
  const cash = state.accounts.filter((a) => a.active).reduce((a, acc) => a + acc.balance, 0);
  const chart = state.series.slice(-14).map((p) => ({
    d: p.date.slice(8),
    Ingresos: p.cobrado,
    Egresos: p.desembolsado,
  }));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Tesorería"
        title="Finanzas"
        description="Caja Argentina en ARS. Cobranzas MP/CBU vs. desembolsos manuales."
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Caja consolidada" value={formatARS(cash)} hintTone="ok" />
        <StatCard label="Ingresos (libro)" value={formatARS(ingresos)} />
        <StatCard label="Egresos (libro)" value={formatARS(egresos)} />
        <StatCard label="Resultado libro" value={formatARS(ingresos - egresos)} hintTone={ingresos - egresos >= 0 ? "ok" : "bad"} />
      </div>
      <div className="card p-4">
        <p className="font-semibold">Flujo 14 días</p>
        <p className="mb-3 text-[12.5px] text-muted">Cobrado vs. desembolsado</p>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatARS(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#20BD5A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Egresos" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">Libro tesorería</div>
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase text-slate-400">
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Concepto</th>
              <th className="px-4 py-2">Contraparte</th>
              <th className="px-4 py-2">Importe</th>
            </tr>
          </thead>
          <tbody>
            {state.ledger.map((l) => {
              const acc = state.accounts.find((a) => a.id === l.accountId);
              return (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{formatDate(l.date)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={l.type === "ingreso" ? "active" : l.type === "egreso" ? "info" : "pending"}>
                      {l.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{l.concept}</p>
                    <p className="text-[12px] text-muted">{acc?.label}</p>
                  </td>
                  <td className="px-4 py-2.5">{l.counterparty}</td>
                  <td className="px-4 py-2.5 tabular font-semibold">{formatARS(l.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
