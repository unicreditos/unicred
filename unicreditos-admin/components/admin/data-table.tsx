"use client";

import { EmptyState } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchPlaceholder = "Buscar…",
  searchFilter,
  pageSize = 10,
  onRowClick,
  trailing,
}: {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, q: string) => boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  trailing?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query || !searchFilter) return rows;
    return rows.filter((r) => searchFilter(r, query));
  }, [rows, q, searchFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 text-[12.5px] text-muted">
          {trailing}
          <span>
            {filtered.length} registro{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-line bg-slate-50/80 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    title="Sin resultados"
                    description="Probá con otro filtro o término de búsqueda. No hay filas para mostrar."
                  />
                </td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-line/80 last:border-0",
                    onRowClick && "cursor-pointer hover:bg-slate-50/80",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
        <span>
          Página {safePage + 1} de {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
