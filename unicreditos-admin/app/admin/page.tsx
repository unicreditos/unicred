"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { LoanStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { formatARS, formatDate, formatPct, LOAN_STATUS_LABEL, clientName } from "@/lib/format";
import { findClient, findProduct } from "@/lib/lookups";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  IdCard,
  Plus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const QUEUE_ACCENT = {
  amber: "text-amber-600",
  orange: "text-orange-600",
  green: "text-emerald-600",
  blue: "text-brand",
  rose: "text-rose-600",
} as const;

function QueueCard({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  accent: keyof typeof QUEUE_ACCENT;
}) {
  return (
    <Link href={href} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[32px] font-semibold tracking-tight tabular">{value}</p>
      <p className={`mt-1 text-[12.5px] font-semibold ${QUEUE_ACCENT[accent]}`}>{hint}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const { state, source } = useAdmin();
  const dash = source.dashboard();
  const [payOpen, setPayOpen] = useState(false);
  const [disbOpen, setDisbOpen] = useState(false);
  const [creditId, setCreditId] = useState(state.credits.find((c) => c.status === "active")?.id ?? "");
  const [amount, setAmount] = useState("");
  const [disbId, setDisbId] = useState(
    state.disbursements.find((d) => d.status === "queued")?.id ?? "",
  );
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");

  const pie = useMemo(() => {
    const counts: Record<string, number> = {};
    state.applications.forEach((a) => {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({
      name: LOAN_STATUS_LABEL[k as keyof typeof LOAN_STATUS_LABEL] ?? k,
      value: v,
      key: k,
    }));
  }, [state.applications]);

  const pieColors: Record<string, string> = {
    pending: "#d97706",
    approved: "#2563eb",
    rejected: "#e11d48",
    cancelled: "#94a3b8",
  };

  const recent = [...state.applications]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  const chartData = state.series.map((p) => ({
    ...p,
    label: p.date.slice(8, 10) + "/" + p.date.slice(5, 7),
  }));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Control"
        title="Torre de control"
        description={`Colas operativas y salud de la cartera — hoy ${formatDate(new Date().toISOString())}`}
        actions={
          <>
            <Button asChild>
              <Link href="/admin/solicitudes">
                <Plus className="h-4 w-4" /> Nueva solicitud
              </Link>
            </Button>
            <Button onClick={() => setPayOpen(true)}>Registrar cobro</Button>
            <Button variant="success" onClick={() => setDisbOpen(true)}>
              Marcar desembolso
            </Button>
          </>
        }
      />

      <div>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Colas operativas
          </p>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
            Atención hoy
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QueueCard
            href="/admin/solicitudes?estado=pending"
            label="Solicitudes pendientes"
            value={dash.pendingApplications}
            hint="En evaluación · atender hoy"
            accent="amber"
          />
          <QueueCard
            href="/admin/kyc"
            label="KYC pendientes"
            value={dash.pendingKyc}
            hint="Identidad a validar · Didit"
            accent="orange"
          />
          <QueueCard
            href="/admin/desembolsos"
            label="Desembolsos pendientes"
            value={dash.pendingDisbursements}
            hint="Acreditación manual"
            accent="green"
          />
          <QueueCard
            href="/admin/pagos"
            label="Transferencias a revisar"
            value={dash.transfersToReview}
            hint="Conciliación bancaria"
            accent="blue"
          />
          <QueueCard
            href="/admin/cobranzas"
            label="En mora"
            value={dash.inArrears}
            hint="Cuotas vencidas"
            accent="rose"
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Salud de cartera
          </p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            KPIs
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Cartera activa"
            value={formatARS(dash.activePortfolio)}
            hint="Saldo de capital vigente"
            hintTone="ok"
            icon={<CircleDollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Créditos vigentes"
            value={dash.activeCredits}
            hint="Sin interés punitivo"
            hintTone="info"
            icon={<CreditCard className="h-4 w-4" />}
          />
          <StatCard
            label="Ticket promedio"
            value={formatARS(dash.avgTicket)}
            hint="Originación personal / consumo"
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Tasa de mora"
            value={formatPct(dash.moraRate)}
            hint={`${dash.inArrears} créditos con cuota vencida`}
            hintTone={dash.moraRate > 8 ? "bad" : "warn"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Solicitudes · últimos 31 días</p>
              <p className="text-[12.5px] text-muted">Volumen diario de originación Argentina</p>
            </div>
            <Link href="/admin/analitica" className="text-[12.5px] font-semibold text-brand">
              Ver analítica
            </Link>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e6ebf2", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="solicitudes" stroke="#2563EB" fill="url(#sol)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="font-semibold">Estado de solicitudes</p>
          <p className="text-[12.5px] text-muted">Pipeline de originación</p>
          <div className="mx-auto h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {pie.map((e) => (
                    <Cell key={e.key} fill={pieColors[e.key] ?? "#94a3b8"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-[12.5px]">
            {pie.map((e) => (
              <li key={e.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: pieColors[e.key] ?? "#94a3b8" }}
                  />
                  {e.name}
                </span>
                <span className="tabular font-semibold">{e.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Últimas solicitudes</p>
            <Link href="/admin/solicitudes" className="text-[12.5px] font-semibold text-brand">
              Ver todas
            </Link>
          </div>
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2 font-semibold">Solicitud</th>
                <th className="px-4 py-2 font-semibold">Cliente</th>
                <th className="px-4 py-2 font-semibold">Producto</th>
                <th className="px-4 py-2 font-semibold">Monto</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => {
                const c = findClient(state, a.clientId);
                const p = findProduct(state, a.productId);
                return (
                  <tr key={a.id} className="border-t border-line/80">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/solicitudes/${a.id}`} className="font-semibold text-brand">
                        {a.id}
                      </Link>
                      <p className="text-[12px] text-muted">{formatDate(a.createdAt)}</p>
                    </td>
                    <td className="px-4 py-2.5">{c ? clientName(c) : "—"}</td>
                    <td className="px-4 py-2.5">{p?.name}</td>
                    <td className="px-4 py-2.5 tabular font-medium">{formatARS(a.amount)}</td>
                    <td className="px-4 py-2.5">
                      <LoanStatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-[13px] text-muted">Cobrado MTD</p>
            <p className="mt-1 text-[22px] font-semibold tabular">{formatARS(dash.collectedMtd)}</p>
            <p className="mt-1 flex items-center gap-1 text-[12.5px] font-medium text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" /> MercadoPago + transferencias
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[13px] text-muted">Desembolsado MTD</p>
            <p className="mt-1 text-[22px] font-semibold tabular">{formatARS(dash.disbursedMtd)}</p>
            <p className="mt-1 flex items-center gap-1 text-[12.5px] text-muted">
              <Banknote className="h-3.5 w-3.5" /> 100% acreditación manual
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[13px] text-muted">Aprobación</p>
            <p className="mt-1 text-[22px] font-semibold tabular">{formatPct(dash.approvalRate)}</p>
            <p className="mt-1 flex items-center gap-1 text-[12.5px] text-muted">
              <IdCard className="h-3.5 w-3.5" /> Sobre solicitudes decididas
            </p>
          </div>
        </div>
      </div>

      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar cobro"
        description="MercadoPago se concilia solo. La transferencia queda en revisión."
      >
        <div className="space-y-3">
          <label className="block text-[12.5px] font-medium text-slate-600">Crédito</label>
          <NativeSelect className="w-full" value={creditId} onChange={(e) => setCreditId(e.target.value)}>
            {state.credits
              .filter((c) => c.status === "active")
              .map((c) => {
                const cl = findClient(state, c.clientId);
                return (
                  <option key={c.id} value={c.id}>
                    {c.id} · {cl ? clientName(cl) : ""} · cuota {formatARS(c.installmentAmount)}
                  </option>
                );
              })}
          </NativeSelect>
          <label className="block text-[12.5px] font-medium text-slate-600">Importe</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="259785" />
          <label className="block text-[12.5px] font-medium text-slate-600">Notas</label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                const credit = state.credits.find((c) => c.id === creditId);
                source.registerPayment({
                  creditId,
                  amount: Number(amount) || credit?.installmentAmount || 0,
                  channel: "mercadopago",
                  operatorId: CURRENT_OPERATOR_ID,
                  notes: note,
                });
                setPayOpen(false);
              }}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={disbOpen}
        onClose={() => setDisbOpen(false)}
        title="Marcar desembolso"
        description="Acreditación manual a CBU. No hay desembolso automático."
      >
        <div className="space-y-3">
          <NativeSelect className="w-full" value={disbId} onChange={(e) => setDisbId(e.target.value)}>
            {state.disbursements
              .filter((d) => d.status === "queued" || d.status === "processing")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} · {formatARS(d.amount)} · {d.bank}
                </option>
              ))}
          </NativeSelect>
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Referencia bancaria TRX-…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setDisbOpen(false)}>Cancelar</Button>
            <Button
              variant="success"
              onClick={() => {
                source.markDisbursed({
                  disbursementId: disbId,
                  operatorId: CURRENT_OPERATOR_ID,
                  reference: ref || `TRX-UC-${Date.now()}`,
                });
                setDisbOpen(false);
              }}
            >
              Marcar acreditado
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
