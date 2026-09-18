"use client";

import { PageHeader, StatCard } from "@/components/admin/page-header";
import { useAdmin } from "@/lib/data/client";
import { formatDate, formatPct } from "@/lib/format";

export default function BcraPage() {
  const { state } = useAdmin();
  const pol = state.bcra.find((b) => b.code === "POLITICA");
  const ipc = state.bcra.find((b) => b.code === "IPC");
  const tna = state.bcra.find((b) => b.code === "TNA_REF");

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Riesgo"
        title="Variables BCRA"
        description="Referencias de mercado para pricing de crédito de consumo en pesos. No hay indexación UVA en los productos vigentes."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Tasa de política"
          value={pol ? formatPct(pol.value, 1) : "—"}
          hint={pol ? `previa ${formatPct(pol.previous, 1)}` : ""}
          hintTone="info"
        />
        <StatCard
          label="IPC mensual"
          value={ipc ? formatPct(ipc.value, 1) : "—"}
          hint="INDEC"
        />
        <StatCard
          label="TNA ref. consumo"
          value={tna ? formatPct(tna.value, 0) : "—"}
          hint="Techo de comunicación"
        />
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="font-semibold">Serie vigente</p>
          <p className="text-[12.5px] text-muted">Fuente BCRA / INDEC · plaza Argentina</p>
        </div>
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase text-slate-400">
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Variable</th>
              <th className="px-4 py-2">Valor</th>
              <th className="px-4 py-2">Previo</th>
              <th className="px-4 py-2">Δ</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {state.bcra.map((b) => {
              const delta = b.value - b.previous;
              const display =
                b.unit === "%"
                  ? formatPct(b.value, b.value >= 20 ? 1 : 1)
                  : b.value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
              const prev =
                b.unit === "%"
                  ? formatPct(b.previous, 1)
                  : b.previous.toLocaleString("es-AR", { maximumFractionDigits: 2 });
              return (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-mono text-[12px]">{b.code}</td>
                  <td className="px-4 py-2.5 font-medium">{b.name}</td>
                  <td className="px-4 py-2.5 tabular font-semibold">{display}</td>
                  <td className="px-4 py-2.5 tabular text-muted">{prev}</td>
                  <td className={`px-4 py-2.5 tabular ${delta < 0 ? "text-emerald-600" : delta > 0 ? "text-rose-600" : "text-muted"}`}>
                    {delta.toLocaleString("es-AR", { maximumFractionDigits: 2, signDisplay: "exceptZero" })}
                  </td>
                  <td className="px-4 py-2.5">{formatDate(b.asOf)}</td>
                  <td className="px-4 py-2.5 text-muted">{b.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-muted">
        Los productos UNICRÉDITOS cotizan TNA/TEA/CFT fijos en pesos. UVA y CER se muestran como contexto, no como indexación de cuota.
      </p>
    </div>
  );
}
