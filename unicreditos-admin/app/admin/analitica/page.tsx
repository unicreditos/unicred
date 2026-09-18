"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { useAdmin } from "@/lib/data/client";
import { formatARS, formatPct } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnaliticaPage() {
  const { state, source } = useAdmin();
  const dash = source.dashboard();
  const byProduct = state.products.map((p) => ({
    name: p.name,
    volumen: state.credits.filter((c) => c.productId === p.id).reduce((a, c) => a + c.amount, 0),
    n: state.credits.filter((c) => c.productId === p.id).length,
  }));
  const byChannel = [
    {
      name: "MercadoPago",
      monto: state.payments.filter((p) => p.channel === "mercadopago" && p.status === "reconciled").reduce((a, p) => a + p.amount, 0),
    },
    {
      name: "Transferencia",
      monto: state.payments.filter((p) => p.channel === "transferencia" && p.status === "reconciled").reduce((a, p) => a + p.amount, 0),
    },
  ];
  const moraByBucket = [
    { name: "Al día", n: state.credits.filter((c) => c.status === "active" && c.bucket === "al_dia").length },
    { name: "1–30", n: state.credits.filter((c) => c.bucket === "1_30").length },
    { name: "31–60", n: state.credits.filter((c) => c.bucket === "31_60").length },
    { name: "61–90", n: state.credits.filter((c) => c.bucket === "61_90").length },
    { name: "90+", n: state.credits.filter((c) => c.bucket === "90_plus").length },
  ];
  const merchants = [...state.merchants]
    .filter((m) => m.originations > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Control"
        title="Analítica"
        description="Originación, cobranzas y mora de la operación Argentina. Sin vista multi-país."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tasa de aprobación" value={formatPct(dash.approvalRate)} hint="Calificados / decididos" hintTone="info" />
        <StatCard label="Cobrado MTD" value={formatARS(dash.collectedMtd)} hint="MP + CBU conciliados" hintTone="ok" />
        <StatCard label="Desembolsado MTD" value={formatARS(dash.disbursedMtd)} hint="Acreditación manual" />
        <StatCard label="Mora" value={formatPct(dash.moraRate)} hint="Créditos con cuota vencida" hintTone="warn" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <p className="font-semibold">Originación vs. cobrado</p>
          <p className="mb-3 text-[12.5px] text-muted">Pesos por día · septiembre 2026</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={state.series.map((p) => ({ ...p, d: p.date.slice(8) }))}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => formatARS(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="desembolsado" name="Desembolsado" stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="font-semibold">Volumen por producto</p>
          <p className="mb-3 text-[12.5px] text-muted">Capital originado (ARS)</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v) => formatARS(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="volumen" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="font-semibold">Canales de cobro</p>
          <p className="mb-3 text-[12.5px] text-muted">Solo pagos conciliados</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel} layout="vertical">
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatARS(Number(v))} />
                <Bar dataKey="monto" fill="#20BD5A" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="font-semibold">Buckets de mora</p>
          <p className="mb-3 text-[12.5px] text-muted">Sin recargo punitivo — solo capital + interés pactado</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moraByBucket}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip />
                <Bar dataKey="n" fill="#0B1220" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="font-semibold">Comercios por volumen</p>
          <p className="text-[12.5px] text-muted">Consumo en puntos de venta adheridos</p>
        </div>
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2">Comercio</th>
              <th className="px-4 py-2">Originaciones</th>
              <th className="px-4 py-2">Volumen</th>
              <th className="px-4 py-2">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium">{m.name}</td>
                <td className="px-4 py-2.5 tabular">{m.originations}</td>
                <td className="px-4 py-2.5 tabular">{formatARS(m.volume)}</td>
                <td className="px-4 py-2.5">{formatPct(m.commissionPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
