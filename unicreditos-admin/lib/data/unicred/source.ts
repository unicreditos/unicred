import type {
  AdminDataSource,
  ApproveInput,
  DisburseInput,
  KycDecisionInput,
  MatchTransferInput,
  RegisterPaymentInput,
  RejectInput,
} from "@/lib/data/contracts";
import type { AdminState, DashboardSnapshot, Operator, OperatorRole } from "@/lib/domain/types";
import { apiUrl, clearToken, getToken } from "@/lib/data/auth";

type Listener = () => void;
export type SourceStatus = "idle" | "loading" | "ready" | "error";

const listeners = new Set<Listener>();
let state: AdminState = emptyState();
let status: SourceStatus = "idle";
let errorMessage: string | null = null;
let cachedOperator: { name: string; email: string } = { name: "", email: "" };

/** Único punto de verdad del operador logueado: lo fija load()/mutate() con
 * el id real que devuelve el backend (GET /api/admin/desk → operatorId),
 * nunca un valor hardcodeado. Exportado como `let` para que los ~14 archivos
 * que ya hacían `import { CURRENT_OPERATOR_ID }` seguían funcionando sin
 * tocarlos uno por uno: los bindings de ESM son "live", así que ven el valor
 * actualizado apenas cambia acá. */
export let CURRENT_OPERATOR_ID = "";

function emit() {
  listeners.forEach((l) => l());
}

function emptyState(): AdminState {
  return {
    products: [],
    operators: [],
    merchants: [],
    clients: [],
    kyc: [],
    applications: [],
    credits: [],
    payments: [],
    disbursements: [],
    collections: [],
    approvals: [],
    receipts: [],
    accounts: [],
    ledger: [],
    cendeu: [],
    bcra: [],
    contracts: [],
    tickets: [],
    audit: [],
    config: {
      companyName: "UNICRÉDITOS",
      cuit: "",
      timezone: "America/Argentina/Buenos_Aires",
      locale: "es-AR",
      currency: "ARS",
      manualDisbursement: true,
      punitiveInterest: false,
      kycProvider: "didit",
      mpCollectorId: "",
      supportEmail: "soporte@unicreditos.com",
      collectionsSlaHours: 24,
    },
    series: [],
  };
}

function initialsFromName(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** Solo para el badge del operador en el topbar; no tiene efecto de permisos
 * (esos ya los aplicó el backend antes de responder). */
function roleFromPermissions(perms: string[]): OperatorRole {
  const has = (k: string) => perms.includes(k);
  if (has("users.manage")) return "director";
  if (has("finance.read")) return "tesoreria";
  if (has("risk.score.write") || has("risk.rules.write")) return "riesgo";
  if (has("audit.read")) return "auditor";
  if (has("credits.approve") || has("merchants.write")) return "originacion";
  return "soporte";
}

/**
 * El snapshot que arma el backend oculta la sección `operators` completa
 * si el operador no tiene el permiso `users.manage` (ver
 * lib/admin-desk/permissions.ts en el repo unicred). Sin esto, el topbar
 * (`state.operators.find(o => o.id === CURRENT_OPERATOR_ID)!`) explota para
 * cualquier rol que no sea director/gerente/super_admin: un operador siempre
 * tiene que poder verse a sí mismo.
 */
function ensureSelfOperator(
  s: AdminState,
  operatorId: string,
  operator: { name: string; email: string },
  perms: string[],
): AdminState {
  if (!operatorId || s.operators.some((o) => o.id === operatorId)) return s;
  const self: Operator = {
    id: operatorId,
    name: operator.name || operator.email || "Operador",
    email: operator.email || "",
    role: roleFromPermissions(perms),
    initials: initialsFromName(operator.name || operator.email || "?"),
    active: true,
    lastSeen: new Date().toISOString(),
  };
  return { ...s, operators: [self, ...s.operators] };
}

function dashboardFrom(s: AdminState): DashboardSnapshot {
  const pendingApplications = s.applications.filter((a) => a.status === "pending").length;
  const pendingKyc = s.kyc.filter((k) => k.status === "pending" || k.status === "in_review").length;
  const pendingDisbursements = s.disbursements.filter((d) => d.status === "queued" || d.status === "processing").length;
  const transfersToReview = s.payments.filter((p) => p.channel === "transferencia" && p.status === "pending").length;
  const inArrears = s.credits.filter((c) => c.status === "active" && c.daysPastDue > 0).length;
  const activeCredits = s.credits.filter((c) => c.status === "active");
  const activePortfolio = activeCredits.reduce((a, c) => a + c.principalOutstanding, 0);
  const avgTicket = activeCredits.length
    ? Math.round(activeCredits.reduce((a, c) => a + c.amount, 0) / activeCredits.length)
    : 0;
  const decided = s.applications.filter((a) => a.status === "approved" || a.status === "rejected");
  const approvalRate = decided.length
    ? (s.applications.filter((a) => a.status === "approved").length / decided.length) * 100
    : 0;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const collectedMtd = s.payments
    .filter((p) => p.status === "reconciled" && p.paidAt.startsWith(month))
    .reduce((a, p) => a + p.amount, 0);
  const disbursedMtd = s.disbursements
    .filter((d) => d.status === "completed" && d.completedAt?.startsWith(month))
    .reduce((a, d) => a + d.amount, 0);
  const moraDenom = activeCredits.length || 1;
  const moraRate = (inArrears / moraDenom) * 100;
  return {
    pendingApplications,
    pendingKyc,
    pendingDisbursements,
    transfersToReview,
    inArrears,
    activePortfolio,
    activeCredits: activeCredits.length,
    avgTicket,
    moraRate,
    collectedMtd,
    disbursedMtd,
    approvalRate,
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("unauthorized");
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    clearToken();
    throw new Error(data?.message || "Tu sesión venció. Iniciá sesión de nuevo.");
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Error ${res.status}`);
  }
  return data as T;
}

type DeskSnapshotResponse = {
  state: AdminState;
  degraded: boolean;
  buildError?: string;
  operatorId: string;
  operator: { id: string; name: string; email: string };
  permissions: string[];
};

async function load(): Promise<void> {
  status = "loading";
  errorMessage = null;
  emit();
  try {
    const data = await apiFetch<DeskSnapshotResponse>("/api/admin/desk");
    CURRENT_OPERATOR_ID = data.operatorId;
    cachedOperator = { name: data.operator?.name || "", email: data.operator?.email || "" };
    state = ensureSelfOperator(data.state, data.operatorId, cachedOperator, data.permissions);
    status = "ready";
    if (data.degraded) {
      errorMessage = data.buildError || "El backoffice está en modo degradado (revisá la conexión a la base).";
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "No se pudo cargar el backoffice";
  }
  emit();
}

type MutateResponse = {
  ok: boolean;
  id?: string;
  error?: string;
  message?: string;
  state?: AdminState;
  operatorId?: string;
  degraded?: boolean;
  buildError?: string;
  permissions?: string[];
};

async function mutate(action: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const data = await apiFetch<MutateResponse>("/api/admin/desk/mutate", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });
    if (data.state) {
      state = ensureSelfOperator(
        data.state,
        data.operatorId || CURRENT_OPERATOR_ID,
        cachedOperator,
        data.permissions || [],
      );
      if (data.degraded) errorMessage = data.buildError || errorMessage;
    }
    if (data.ok === false) {
      throw new Error(data.error || "No se pudo completar la acción");
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "No se pudo completar la acción";
  }
  emit();
}

export const unicredSource: AdminDataSource = {
  getState() {
    return state;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  dashboard() {
    return dashboardFrom(state);
  },
  getClient(id) {
    return state.clients.find((c) => c.id === id);
  },
  getCredit(id) {
    return state.credits.find((c) => c.id === id);
  },
  getApplication(id) {
    return state.applications.find((a) => a.id === id);
  },
  getMerchant(id) {
    return state.merchants.find((m) => m.id === id);
  },
  getPayment(id) {
    return state.payments.find((p) => p.id === id);
  },
  approveApplication(input: ApproveInput) {
    void mutate("approveApplication", { applicationId: input.applicationId, comment: input.comment });
  },
  rejectApplication(input: RejectInput) {
    void mutate("rejectApplication", { applicationId: input.applicationId, comment: input.comment });
  },
  cancelApplication(id, _operatorId, reason) {
    void mutate("cancelApplication", { id, reason });
  },
  decideKyc(input: KycDecisionInput) {
    void mutate("decideKyc", { kycId: input.kycId, status: input.status, notes: input.notes });
  },
  markDisbursed(input: DisburseInput) {
    void mutate("markDisbursed", { disbursementId: input.disbursementId, reference: input.reference });
  },
  registerPayment(input: RegisterPaymentInput) {
    void mutate("registerPayment", {
      creditId: input.creditId,
      amount: input.amount,
      channel: input.channel,
      notes: input.notes,
    });
  },
  matchTransfer(input: MatchTransferInput) {
    void mutate("matchTransfer", { paymentId: input.paymentId });
  },
  rejectTransfer(paymentId, _operatorId, reason) {
    void mutate("rejectTransfer", { paymentId, reason });
  },
  logCollectionContact(caseId, _operatorId, note) {
    void mutate("logCollectionContact", { caseId, note, nextAction: note });
  },
  updateConfig() {
    // El backend todavía no tiene una acción para persistir config (no hay
    // 'updateConfig' en DESK_ACTION_PERMISSION / deskMutate). Avisar en vez
    // de fingir que guardó: config hoy sale de env vars + defaults server-side.
    errorMessage = "La configuración todavía no se puede editar desde este panel.";
    emit();
  },
  resolveTicket(id, _operatorId) {
    void mutate("resolveTicket", { id });
  },
  pauseMerchant(id, _operatorId) {
    void mutate("pauseMerchant", { id });
  },
  activateMerchant(id, _operatorId) {
    void mutate("activateMerchant", { id });
  },
};

export function initSource() {
  if (status === "loading") return;
  void load();
}

export function getSourceStatus(): SourceStatus {
  return status;
}

export function getSourceError(): string | null {
  return errorMessage;
}

export function resetSource() {
  clearToken();
  state = emptyState();
  status = "idle";
  errorMessage = null;
  CURRENT_OPERATOR_ID = "";
  emit();
}
