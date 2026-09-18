"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/data/auth";
import { getSourceError, getSourceStatus, initSource, unicredSource, type SourceStatus } from "@/lib/data/unicred/source";

const USE_MOCK = process.env.NEXT_PUBLIC_ADMIN_USE_MOCK === "1";

/**
 * Guarda /admin: sin token redirige a /login, mientras carga el primer
 * snapshot muestra un loader, y si el fetch falla muestra el error con
 * reintentar en vez de dejar que Topbar explote buscando un operador que
 * todavía no llegó (state.operators.find(...)! en components/admin/topbar.tsx).
 *
 * Es el ÚNICO lugar que llama initSource() — useAdmin() (lib/data/client.ts)
 * deliberadamente no lo hace, porque eso causaba un loop: cada vez que este
 * gate dejaba pasar a los hijos, Topbar/las páginas montaban, su propio
 * efecto disparaba otro initSource(), status volvía a "loading", los hijos
 * se desmontaban, y así indefinidamente contra /api/admin/desk.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<SourceStatus>(USE_MOCK ? "ready" : getSourceStatus());
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Deliberadamente sin `router` en las deps: solo queremos correr esto
    // una vez al montar, no en cada render.
    if (USE_MOCK) return;
    const token = getToken();
    setHasToken(Boolean(token));
    if (!token) {
      router.replace("/login");
      return;
    }
    const unsub = unicredSource.subscribe(() => setStatus(getSourceStatus()));
    initSource();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (USE_MOCK) return <>{children}</>;

  if (hasToken === null || hasToken === false) return null;

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-ink">No se pudo cargar el backoffice</p>
          <p className="mt-2 text-sm text-slate-500">{getSourceError() || "Error desconocido"}</p>
          <Button className="mt-6 w-full" variant="primary" onClick={() => initSource()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-slate-500">Cargando backoffice…</p>
      </div>
    );
  }

  return <>{children}</>;
}
