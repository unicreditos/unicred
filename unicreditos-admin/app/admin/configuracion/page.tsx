"use client";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/lib/data/client";
import { useState } from "react";

export default function ConfiguracionPage() {
  const { state, source } = useAdmin();
  const [email, setEmail] = useState(state.config.supportEmail);
  const [sla, setSla] = useState(String(state.config.collectionsSlaHours));
  const [mp, setMp] = useState(state.config.mpCollectorId);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        kicker="Sistema"
        title="Configuración"
        description="Parámetros de la operación Argentina. El desembolso es siempre manual y no hay interés punitivo."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-4">
          <p className="font-semibold">Sociedad</p>
          <div>
            <p className="text-[12px] text-muted">Razón social</p>
            <p className="font-medium">{state.config.companyName}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">CUIT</p>
            <p className="font-medium tabular">{state.config.cuit}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Zona horaria / locale</p>
            <p className="font-medium">
              {state.config.timezone} · {state.config.locale} · {state.config.currency}
            </p>
          </div>
        </div>
        <div className="card p-5 space-y-4">
          <p className="font-semibold">Políticas no negociables</p>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-[13.5px]">
            <span>Desembolso manual a CBU</span>
            <span className="font-semibold text-emerald-700">{state.config.manualDisbursement ? "Activo" : "Off"}</span>
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-[13.5px]">
            <span>Interés punitivo</span>
            <span className="font-semibold text-slate-500">{state.config.punitiveInterest ? "Activo" : "Deshabilitado"}</span>
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-[13.5px]">
            <span>Proveedor KYC</span>
            <span className="font-semibold capitalize">{state.config.kycProvider}</span>
          </label>
        </div>
        <div className="card p-5 space-y-3 lg:col-span-2">
          <p className="font-semibold">Operación</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[12.5px] font-medium text-slate-600">
              Email de soporte
              <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-[12.5px] font-medium text-slate-600">
              SLA cobranzas (horas)
              <Input className="mt-1" value={sla} onChange={(e) => setSla(e.target.value)} />
            </label>
            <label className="block text-[12.5px] font-medium text-slate-600">
              Collector MercadoPago
              <Input className="mt-1" value={mp} onChange={(e) => setMp(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => {
                source.updateConfig({
                  supportEmail: email,
                  collectionsSlaHours: Number(sla) || 24,
                  mpCollectorId: mp,
                });
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
            >
              Guardar cambios
            </Button>
            {saved ? <span className="text-[13px] font-medium text-emerald-700">Guardado en el store mock</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
