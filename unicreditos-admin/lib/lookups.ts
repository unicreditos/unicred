import type { AdminState } from "@/lib/domain/types";

export function findClient(state: AdminState, id: string) {
  return state.clients.find((c) => c.id === id);
}

export function findProduct(state: AdminState, id: string) {
  return state.products.find((p) => p.id === id);
}

export function findMerchant(state: AdminState, id: string | null) {
  if (!id) return undefined;
  return state.merchants.find((m) => m.id === id);
}

export function findOperator(state: AdminState, id: string | null) {
  if (!id) return undefined;
  return state.operators.find((o) => o.id === id);
}

export function findCredit(state: AdminState, id: string) {
  return state.credits.find((c) => c.id === id);
}
