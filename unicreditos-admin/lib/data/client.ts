import { mockSource } from "@/lib/data/mock";
import { unicredSource } from "@/lib/data/unicred/source";
import type { AdminDataSource } from "@/lib/data/contracts";
import { useSyncExternalStore } from "react";

/**
 * NEXT_PUBLIC_ADMIN_USE_MOCK=1 vuelve al dataset en memoria (útil para
 * cablear pantallas sin depender del backend). Por defecto usa el backend
 * real (GET/POST /api/admin/desk en el repo unicred) vía unicredSource.
 */
const USE_MOCK = process.env.NEXT_PUBLIC_ADMIN_USE_MOCK === "1";

export function getAdminDataSource(): AdminDataSource {
  return USE_MOCK ? mockSource : unicredSource;
}

/**
 * El primer fetch lo dispara únicamente AdminGate (components/admin/admin-gate.tsx),
 * que es quien decide cuándo mostrar el loader vs. los hijos. Este hook NO debe
 * llamar initSource(): si lo hiciera, cada vez que AdminGate deja pasar a los
 * hijos (status "ready"), Topbar/las páginas montan, este efecto dispara OTRO
 * initSource(), status vuelve a "loading", los hijos se desmontan — y así en
 * loop infinito contra /api/admin/desk. useAdmin() solo lee el estado ya cargado.
 */
export function useAdmin() {
  const source = getAdminDataSource();
  const state = useSyncExternalStore(
    (onStoreChange) => source.subscribe(onStoreChange),
    () => source.getState(),
    () => source.getState(),
  );
  return { state, source };
}

// Antes era un string fijo ("op-au", un id que solo existe en el seed mock).
// Con el backend real, unicredSource.CURRENT_OPERATOR_ID lo fija load()/mutate()
// con el id real del operador logueado; el binding de ESM es "live", así que
// esta re-exportación refleja ese valor sin que haga falta tocar los ~14
// archivos que ya hacían `import { CURRENT_OPERATOR_ID } from "@/lib/data/client"`.
export { CURRENT_OPERATOR_ID } from "@/lib/data/unicred/source";
