"use client";

import { Button } from "@/components/ui/button";
import { CURRENT_OPERATOR_ID, useAdmin } from "@/lib/data/client";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { clientName, formatARS } from "@/lib/format";
import { Bell, Command, Menu, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  director: "Dirección",
  originacion: "Originación",
  tesoreria: "Tesorería",
  riesgo: "Riesgo",
  soporte: "Soporte",
  auditor: "Auditoría",
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state } = useAdmin();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const modules = ALL_NAV_ITEMS.filter(
    (i) => !query || i.label.toLowerCase().includes(query),
  );
  const clients = useMemo(
    () =>
      state.clients
        .filter((c) => {
          const n = `${c.firstName} ${c.lastName} ${c.dni} ${c.id}`.toLowerCase();
          return query && n.includes(query);
        })
        .slice(0, 5),
    [state.clients, query],
  );
  const credits = useMemo(
    () =>
      state.credits
        .filter((c) => query && c.id.toLowerCase().includes(query))
        .slice(0, 5),
    [state.credits, query],
  );
  const apps = useMemo(
    () =>
      state.applications
        .filter((a) => query && a.id.toLowerCase().includes(query))
        .slice(0, 5),
    [state.applications, query],
  );

  function go(href: string) {
    router.push(href);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button className="absolute inset-0 bg-navy/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-up">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ir a un módulo, cliente, crédito o solicitud…"
            className="h-12 w-full bg-transparent text-[14px] outline-none"
          />
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-slate-400 sm:inline">
            Esc
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Módulos
          </p>
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.href}
                type="button"
                onClick={() => go(m.href)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{m.label}</span>
                <span className="ml-auto text-[12px] text-slate-400">{m.href}</span>
              </button>
            );
          })}
          {clients.length > 0 && (
            <>
              <p className="mt-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Clientes
              </p>
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go(`/admin/clientes/${c.id}`)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-slate-50"
                >
                  <span className="font-medium">{clientName(c)}</span>
                  <span className="text-[12px] text-slate-400">DNI {c.dni}</span>
                </button>
              ))}
            </>
          )}
          {credits.length > 0 && (
            <>
              <p className="mt-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Créditos
              </p>
              {credits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go(`/admin/creditos/${c.id}`)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-slate-50"
                >
                  <span className="font-medium">{c.id}</span>
                  <span className="text-[12px] text-slate-400">{formatARS(c.amount)}</span>
                </button>
              ))}
            </>
          )}
          {apps.length > 0 && (
            <>
              <p className="mt-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Solicitudes
              </p>
              {apps.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => go(`/admin/solicitudes/${a.id}`)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-slate-50"
                >
                  <span className="font-medium">{a.id}</span>
                  <span className="text-[12px] text-slate-400">{formatARS(a.amount)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [cmd, setCmd] = useState(false);
  const { state } = useAdmin();
  const op = state.operators.find((o) => o.id === CURRENT_OPERATOR_ID)!;
  const openTickets = state.tickets.filter((t) => t.status === "open").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const paletteChord =
        (mod && key === "k") || (mod && key === "j") || (mod && e.code === "KeyK");
      const slash =
        key === "/" &&
        !mod &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLElement && e.target.isContentEditable);

      if (!paletteChord && !slash) return;
      e.preventDefault();
      e.stopPropagation();
      setCmd((v) => (slash ? true : !v));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <>
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/60 px-4">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-white lg:hidden"
          onClick={onMenu}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setCmd(true)}
          className="flex h-9 flex-1 items-center gap-2 rounded-[10px] border border-line bg-white/80 px-3 text-left text-[13px] text-slate-400 shadow-sm sm:max-w-md"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1">Buscar en el backoffice…</span>
          <span className="hidden items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:flex">
            <Command className="h-3 w-3" />K
            <span className="mx-0.5 text-slate-300">/</span>
            /
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/admin/soporte">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {openTickets > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </Button>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-line bg-white/70 py-1 pl-1 pr-3 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {op.initials}
            </div>
            <div className="leading-tight">
              <p className="text-[12.5px] font-semibold">{op.name.split(" ")[0]}</p>
              <p className="text-[10.5px] text-muted">{ROLE_LABEL[op.role] || op.role}</p>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white sm:hidden">
            {op.initials}
          </div>
        </div>
      </header>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </>
  );
}
