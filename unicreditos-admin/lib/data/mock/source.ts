import type { AdminDataSource, AdminState, ApproveInput, DisburseInput, KycDecisionInput, MatchTransferInput, RegisterPaymentInput, RejectInput } from "@/lib/data/contracts";
import type { AppConfig, DashboardSnapshot, LoanApplication } from "@/lib/domain/types";
import { buildSeed } from "@/lib/data/mock/seed";

type Listener = () => void;

let state: AdminState = buildSeed();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function nowIso() {
  return new Date().toISOString();
}

function audit(actorId: string, action: string, entity: string, entityId: string, detail: string) {
  state = {
    ...state,
    audit: [
      {
        id: `aud-${state.audit.length + 1}-${Date.now()}`,
        at: nowIso(),
        actorId,
        action,
        entity,
        entityId,
        detail,
      },
      ...state.audit,
    ],
  };
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
  const month = "2026-09";
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

export const mockSource: AdminDataSource = {
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
  async createApplication(input) {
    const id = `SOL-MOCK-${state.applications.length + 1}`;
    state = {
      ...state,
      applications: [
        {
          id,
          clientId: input.clientId,
          productId: input.productId,
          merchantId: input.merchantId || null,
          amount: input.amount,
          installments: input.installments,
          status: "pending",
          purpose: input.purpose,
          createdAt: new Date().toISOString(),
          decidedAt: null,
          operatorId: null,
          notes: "",
        },
        ...state.applications,
      ],
    };
    emit();
  },
  approveApplication(input: ApproveInput) {
    const app = state.applications.find((a) => a.id === input.applicationId);
    if (!app || app.status !== "pending") return;
    const product = state.products.find((p) => p.id === app.productId)!;
    const client = state.clients.find((c) => c.id === app.clientId)!;
    const creditId = `CR-26-${String(200 + state.credits.length).padStart(3, "0")}`;
    const monthly = product.tna / 100 / 12;
    const inst = Math.round(
      (app.amount * monthly) / (1 - Math.pow(1 + monthly, -app.installments)),
    );
    const firstDue = new Date();
    firstDue.setDate(firstDue.getDate() + 30);
    const schedule = Array.from({ length: app.installments }, (_, k) => {
      const due = new Date(firstDue);
      due.setMonth(due.getMonth() + k);
      return {
        number: k + 1,
        dueDate: due.toISOString(),
        amount: inst,
        paidAmount: 0,
        paidAt: null,
        status: "pending" as const,
      };
    });
    const applications: LoanApplication[] = state.applications.map((a) =>
      a.id === app.id
        ? { ...a, status: "approved", decidedAt: nowIso(), operatorId: input.operatorId, notes: input.comment }
        : a,
    );
    state = {
      ...state,
      applications,
      approvals: state.approvals.map((a) =>
        a.applicationId === app.id
          ? { ...a, decision: "approved", decidedAt: nowIso(), comment: input.comment }
          : a,
      ),
      credits: [
        {
          id: creditId,
          applicationId: app.id,
          clientId: app.clientId,
          productId: app.productId,
          merchantId: app.merchantId,
          amount: app.amount,
          principalOutstanding: inst * app.installments,
          installments: app.installments,
          installmentAmount: inst,
          tna: product.tna,
          tea: product.tea,
          cft: product.cft,
          status: "approved",
          disbursedAt: null,
          firstDueDate: firstDue.toISOString(),
          schedule,
          daysPastDue: 0,
          bucket: "al_dia",
        },
        ...state.credits,
      ],
      disbursements: [
        {
          id: `db-${String(state.disbursements.length + 1).padStart(3, "0")}`,
          creditId,
          clientId: app.clientId,
          amount: app.amount,
          status: "queued",
          cbu: client.cbu,
          bank: client.bank,
          requestedAt: nowIso(),
          completedAt: null,
          operatorId: null,
          reference: null,
        },
        ...state.disbursements,
      ],
    };
    audit(input.operatorId, "application.approve", "solicitud", app.id, `Calificó ${app.id} — ${input.comment}`);
    emit();
  },
  rejectApplication(input: RejectInput) {
    const app = state.applications.find((a) => a.id === input.applicationId);
    if (!app || app.status !== "pending") return;
    state = {
      ...state,
      applications: state.applications.map((a) =>
        a.id === app.id
          ? { ...a, status: "rejected", decidedAt: nowIso(), operatorId: input.operatorId, notes: input.comment }
          : a,
      ),
      approvals: state.approvals.map((a) =>
        a.applicationId === app.id
          ? { ...a, decision: "rejected", decidedAt: nowIso(), comment: input.comment }
          : a,
      ),
    };
    audit(input.operatorId, "application.reject", "solicitud", app.id, input.comment);
    emit();
  },
  cancelApplication(id, operatorId, reason) {
    state = {
      ...state,
      applications: state.applications.map((a) =>
        a.id === id ? { ...a, status: "cancelled", decidedAt: nowIso(), operatorId, notes: reason } : a,
      ),
    };
    audit(operatorId, "application.cancel", "solicitud", id, reason);
    emit();
  },
  decideKyc(input: KycDecisionInput) {
    state = {
      ...state,
      kyc: state.kyc.map((k) =>
        k.id === input.kycId
          ? {
              ...k,
              status: input.status,
              completedAt: nowIso(),
              operatorId: input.operatorId,
              notes: input.notes,
              documentMatch: input.status === "verified",
            }
          : k,
      ),
      clients: state.clients.map((c) => {
        const k = state.kyc.find((x) => x.id === input.kycId);
        if (!k || c.id !== k.clientId) return c;
        return { ...c, kycStatus: input.status };
      }),
    };
    audit(input.operatorId, "kyc.decide", "kyc", input.kycId, `${input.status}: ${input.notes}`);
    emit();
  },
  markDisbursed(input: DisburseInput) {
    const row = state.disbursements.find((d) => d.id === input.disbursementId);
    if (!row) return;
    state = {
      ...state,
      disbursements: state.disbursements.map((d) =>
        d.id === input.disbursementId
          ? {
              ...d,
              status: "completed",
              completedAt: nowIso(),
              operatorId: input.operatorId,
              reference: input.reference,
            }
          : d,
      ),
      credits: state.credits.map((c) =>
        c.id === row.creditId ? { ...c, status: "active", disbursedAt: nowIso() } : c,
      ),
      receipts: [
        {
          id: `rcp-d-new-${Date.now()}`,
          paymentId: null,
          disbursementId: row.id,
          clientId: row.clientId,
          type: "desembolso",
          number: `D-2026-${String(700 + state.receipts.length).padStart(4, "0")}`,
          amount: row.amount,
          issuedAt: nowIso(),
          cae: null,
        },
        ...state.receipts,
      ],
    };
    audit(input.operatorId, "disbursement.complete", "desembolso", row.id, `Acreditado ${input.reference}`);
    emit();
  },
  registerPayment(input: RegisterPaymentInput) {
    const credit = state.credits.find((c) => c.id === input.creditId);
    if (!credit) return;
    const id = `pay-manual-${Date.now()}`;
    const nextPending = credit.schedule.find((s) => s.status === "pending" || s.status === "overdue");
    const schedule = credit.schedule.map((s) =>
      nextPending && s.number === nextPending.number
        ? { ...s, status: "paid" as const, paidAmount: input.amount, paidAt: nowIso() }
        : s,
    );
    const remaining = schedule.filter((s) => s.status !== "paid").reduce((a, s) => a + s.amount - s.paidAmount, 0);
    const allPaid = schedule.every((s) => s.status === "paid");
    state = {
      ...state,
      payments: [
        {
          id,
          creditId: credit.id,
          clientId: credit.clientId,
          channel: input.channel,
          status: input.channel === "transferencia" ? "pending" : "reconciled",
          amount: input.amount,
          paidAt: nowIso(),
          mpPaymentId: input.channel === "mercadopago" ? `mp_manual_${Date.now()}` : null,
          transferCbu: input.channel === "transferencia" ? state.clients.find((c) => c.id === credit.clientId)?.cbu ?? null : null,
          transferRef: input.channel === "transferencia" ? `VAR-MAN-${Date.now() % 100000}` : null,
          matchedBy: input.channel === "mercadopago" ? input.operatorId : null,
          notes: input.notes ?? "",
        },
        ...state.payments,
      ],
      credits: state.credits.map((c) =>
        c.id === credit.id
          ? {
              ...c,
              schedule,
              principalOutstanding: remaining,
              status: allPaid ? "paid" : c.status,
              daysPastDue: allPaid ? 0 : c.daysPastDue,
              bucket: allPaid ? "al_dia" : c.bucket,
            }
          : c,
      ),
    };
    audit(input.operatorId, "payment.register", "pago", id, `Cobro ${input.channel} ${input.amount}`);
    emit();
  },
  matchTransfer(input: MatchTransferInput) {
    const pay = state.payments.find((p) => p.id === input.paymentId);
    if (!pay) return;
    state = {
      ...state,
      payments: state.payments.map((p) =>
        p.id === input.paymentId ? { ...p, status: "reconciled", matchedBy: input.operatorId } : p,
      ),
      receipts: [
        {
          id: `rcp-m-${Date.now()}`,
          paymentId: pay.id,
          disbursementId: null,
          clientId: pay.clientId,
          type: "cobro",
          number: `C-2026-${String(800 + state.receipts.length).padStart(4, "0")}`,
          amount: pay.amount,
          issuedAt: nowIso(),
          cae: `7410${String(Date.now()).slice(-10)}`,
        },
        ...state.receipts,
      ],
    };
    audit(input.operatorId, "payment.match", "pago", pay.id, "Transferencia conciliada");
    emit();
  },
  rejectTransfer(paymentId, operatorId, reason) {
    state = {
      ...state,
      payments: state.payments.map((p) =>
        p.id === paymentId ? { ...p, status: "rejected", notes: reason, matchedBy: operatorId } : p,
      ),
    };
    audit(operatorId, "payment.reject", "pago", paymentId, reason);
    emit();
  },
  logCollectionContact(caseId, operatorId, note) {
    state = {
      ...state,
      collections: state.collections.map((c) =>
        c.id === caseId ? { ...c, lastContactAt: nowIso(), nextAction: note } : c,
      ),
    };
    audit(operatorId, "collection.contact", "cobranza", caseId, note);
    emit();
  },
  updateConfig(patch: Partial<AppConfig>) {
    state = { ...state, config: { ...state.config, ...patch } };
    audit("op-au", "config.update", "config", "app", "Actualizó configuración");
    emit();
  },
  resolveTicket(id, operatorId) {
    state = {
      ...state,
      tickets: state.tickets.map((t) =>
        t.id === id ? { ...t, status: "resolved", updatedAt: nowIso(), assigneeId: operatorId } : t,
      ),
    };
    audit(operatorId, "ticket.resolve", "soporte", id, "Ticket resuelto");
    emit();
  },
  pauseMerchant(id, operatorId) {
    state = {
      ...state,
      merchants: state.merchants.map((m) => (m.id === id ? { ...m, status: "paused" } : m)),
    };
    audit(operatorId, "merchant.pause", "comercio", id, "Comercio pausado");
    emit();
  },
  activateMerchant(id, operatorId) {
    state = {
      ...state,
      merchants: state.merchants.map((m) => (m.id === id ? { ...m, status: "active" } : m)),
    };
    audit(operatorId, "merchant.activate", "comercio", id, "Comercio activado");
    emit();
  },
};

export function resetMock() {
  state = buildSeed();
  emit();
}
