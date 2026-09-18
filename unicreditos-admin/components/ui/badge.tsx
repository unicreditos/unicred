import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const tones = {
  pending: "bg-amber-50 text-amber-700 ring-amber-100",
  approved: "bg-sky-50 text-sky-700 ring-sky-100",
  rejected: "bg-rose-50 text-rose-700 ring-rose-100",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  paid: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-slate-50 text-slate-500 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-100",
  warn: "bg-orange-50 text-orange-700 ring-orange-100",
  mint: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  navy: "bg-navy text-mint ring-navy-2",
} as const;

export function Badge({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
