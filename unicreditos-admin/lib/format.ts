import type {
  ApprovalDecision,
  CollectionBucket,
  DisbursementStatus,
  KycStatus,
  LoanStatus,
  MerchantStatus,
  OperatorRole,
  PaymentChannel,
  PaymentStatus,
  TicketPriority,
  TicketStatus,
} from "@/lib/domain/types";

export function formatARS(amount: number, withDecimals = false): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(amount);
  return `$ ${formatted}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatDate(iso)} ${time}`;
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatDni(dni: string): string {
  const n = Number(dni.replace(/\D/g, ""));
  if (Number.isNaN(n)) return dni;
  return n.toLocaleString("es-AR");
}

export function clientName(c: { firstName: string; lastName: string }): string {
  return `${c.lastName}, ${c.firstName}`;
}

export function formatCbu(cbu: string): string {
  const d = cbu.replace(/\s/g, "");
  if (d.length !== 22) return cbu;
  return `${d.slice(0, 8)} ${d.slice(8)}`;
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  pending: "En evaluación",
  approved: "Calificado",
  rejected: "Rechazado",
  active: "Vigente",
  paid: "Cancelado",
  cancelled: "Anulado",
};

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
  expired: "Vencido",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  matched: "Matcheado",
  reconciled: "Conciliado",
  rejected: "Rechazado",
  refunded: "Devuelto",
};

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  mercadopago: "MercadoPago",
  transferencia: "Transferencia",
};

export const DISBURSEMENT_STATUS_LABEL: Record<DisbursementStatus, string> = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Acreditado",
  failed: "Fallido",
};

export const BUCKET_LABEL: Record<CollectionBucket, string> = {
  al_dia: "Al día",
  "1_30": "1–30 días",
  "31_60": "31–60 días",
  "61_90": "61–90 días",
  "90_plus": "90+ días",
};

export const MERCHANT_STATUS_LABEL: Record<MerchantStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  onboarding: "Alta",
  rejected: "Rechazado",
};

export const ROLE_LABEL: Record<OperatorRole, string> = {
  director: "Dirección",
  originacion: "Originación",
  tesoreria: "Tesorería",
  riesgo: "Riesgo",
  soporte: "Soporte",
  auditor: "Auditoría",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Abierto",
  pending: "En espera",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const APPROVAL_LABEL: Record<ApprovalDecision, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  observed: "Observado",
  rejected: "Rechazado",
};

export const CENDEU_LABEL = {
  ok: "Situación 1",
  novedad: "Novedad",
  irregular: "Irregular",
  sin_info: "Sin información",
} as const;
