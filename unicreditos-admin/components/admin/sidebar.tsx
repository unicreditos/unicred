"use client";

import { LogoMark } from "@/components/admin/logo";
import { useAdmin } from "@/lib/data/client";
import { isNavActive, NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state, source } = useAdmin();
  const dash = source.dashboard();
  const badges: Record<string, number> = {
    applications: dash.pendingApplications,
    kyc: dash.pendingKyc,
    disbursements: dash.pendingDisbursements,
    transfers: dash.transfersToReview,
    approvals: state.approvals.filter((a) => a.decision === "pending" || a.decision === "observed").length,
    collections: dash.inArrears,
    tickets: state.tickets.filter((t) => t.status === "open" || t.status === "pending").length,
  };

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#070B14_0%,#0B1220_55%,#0D1526_100%)] text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <LogoMark />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold tracking-wide text-white">UNICRÉDITOS</p>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Backoffice
          </p>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[10px] px-3 py-[8px] text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-[#2563EB] text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-[16px] w-[16px] shrink-0 opacity-90" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count ? (
                        <span
                          className={cn(
                            "min-w-[20px] rounded-full px-1.5 text-center text-[10.5px] font-semibold leading-5",
                            active ? "bg-white/20 text-white" : "bg-amber-500 text-white",
                            item.badge === "collections" && !active && "bg-rose-500",
                            item.badge === "disbursements" && !active && "bg-emerald-500",
                            item.badge === "kyc" && !active && "bg-orange-500",
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-[11px] text-slate-500">Operador en sesión</p>
        <p className="text-[13px] font-medium text-white">Agustina Urrutia</p>
        <p className="text-[11.5px] text-slate-400">Dirección · Argentina</p>
      </div>
    </div>
  );
}
