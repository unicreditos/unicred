import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {kicker ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {kicker}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  hintTone = "muted",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: "muted" | "ok" | "warn" | "bad" | "info";
  icon?: ReactNode;
}) {
  const tones = {
    muted: "text-muted",
    ok: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
    info: "text-brand",
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-tight tabular">{value}</p>
      {hint ? <p className={cn("mt-1 text-[12.5px] font-medium", tones[hintTone])}>{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 h-10 w-10 rounded-full bg-slate-100" />
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-muted">{description}</p>
    </div>
  );
}
