export type LoanStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "paid"
  | "cancelled";

export type KycStatus =
  | "pending"
  | "in_review"
  | "verified"
  | "rejected"
  | "expired";

export type PaymentChannel = "mercadopago" | "transferencia";

export type PaymentStatus =
  | "pending"
  | "matched"
  | "reconciled"
  | "rejected"
  | "refunded";

export type DisbursementStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type CollectionBucket = "al_dia" | "1_30" | "31_60" | "61_90" | "90_plus";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type OperatorRole =
  | "director"
  | "originacion"
  | "tesoreria"
  | "riesgo"
  | "soporte"
  | "auditor";

export type ProductType = "personal" | "consumo" | "refinanciacion";

export type MerchantStatus = "active" | "paused" | "onboarding" | "rejected";

export type ApprovalDecision = "pending" | "approved" | "observed" | "rejected";

export type CendeuResult = "ok" | "novedad" | "irregular" | "sin_info";

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface CreditProduct {
  id: string;
  name: string;
  type: ProductType;
  tna: number;
  tea: number;
  cft: number;
  minAmount: number;
  maxAmount: number;
  minInstallments: number;
  maxInstallments: number;
  active: boolean;
  description: string;
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  role: OperatorRole;
  initials: string;
  active: boolean;
  lastSeen: string;
}

export interface Merchant {
  id: string;
  name: string;
  cuit: string;
  category: string;
  status: MerchantStatus;
  commissionPct: number;
  city: string;
  province: string;
  contact: string;
  email: string;
  phone: string;
  originations: number;
  volume: number;
  onboardedAt: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  cuit: string;
  email: string;
  phone: string;
  address: Address;
  cbu: string;
  bank: string;
  kycStatus: KycStatus;
  score: number;
  createdAt: string;
  occupation: string;
  employer: string;
  declaredIncome: number;
}

export interface KycCase {
  id: string;
  clientId: string;
  provider: "didit";
  status: KycStatus;
  sessionId: string;
  documentType: "dni" | "pasaporte";
  liveness: boolean;
  documentMatch: boolean;
  faceMatchScore: number | null;
  startedAt: string;
  completedAt: string | null;
  notes: string;
  operatorId: string | null;
}

export interface LoanApplication {
  id: string;
  clientId: string;
  productId: string;
  merchantId: string | null;
  amount: number;
  installments: number;
  status: Extract<LoanStatus, "pending" | "approved" | "rejected" | "cancelled">;
  purpose: string;
  createdAt: string;
  decidedAt: string | null;
  operatorId: string | null;
  notes: string;
}

export interface Installment {
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidAt: string | null;
  status: "pending" | "paid" | "partial" | "overdue";
}

export interface Credit {
  id: string;
  applicationId: string;
  clientId: string;
  productId: string;
  merchantId: string | null;
  amount: number;
  principalOutstanding: number;
  installments: number;
  installmentAmount: number;
  tna: number;
  tea: number;
  cft: number;
  status: Extract<LoanStatus, "approved" | "active" | "paid" | "cancelled">;
  disbursedAt: string | null;
  firstDueDate: string;
  schedule: Installment[];
  daysPastDue: number;
  bucket: CollectionBucket;
}

export interface Payment {
  id: string;
  creditId: string;
  clientId: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  amount: number;
  paidAt: string;
  mpPaymentId: string | null;
  transferCbu: string | null;
  transferRef: string | null;
  matchedBy: string | null;
  notes: string;
}

export interface Disbursement {
  id: string;
  creditId: string;
  clientId: string;
  amount: number;
  status: DisbursementStatus;
  cbu: string;
  bank: string;
  requestedAt: string;
  completedAt: string | null;
  operatorId: string | null;
  reference: string | null;
}

export interface CollectionCase {
  id: string;
  creditId: string;
  clientId: string;
  bucket: CollectionBucket;
  overdueAmount: number;
  daysPastDue: number;
  lastContactAt: string | null;
  nextAction: string;
  ownerId: string;
}

export interface Approval {
  id: string;
  applicationId: string;
  clientId: string;
  decision: ApprovalDecision;
  policyFlags: string[];
  assignedTo: string;
  createdAt: string;
  decidedAt: string | null;
  comment: string;
}

export interface Receipt {
  id: string;
  paymentId: string | null;
  disbursementId: string | null;
  clientId: string;
  type: "cobro" | "desembolso" | "nota_credito";
  number: string;
  amount: number;
  issuedAt: string;
  cae: string | null;
}

export interface BankAccount {
  id: string;
  label: string;
  bank: string;
  cbu: string;
  alias: string;
  currency: "ARS";
  purpose: "cobranzas" | "desembolsos" | "operativa";
  balance: number;
  active: boolean;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: "ingreso" | "egreso" | "ajuste";
  accountId: string;
  amount: number;
  concept: string;
  counterparty: string;
}

export interface CendeuReport {
  id: string;
  clientId: string;
  consultedAt: string;
  result: CendeuResult;
  score: number;
  sit1: number;
  sit2: number;
  sit3: number;
  sit4: number;
  sit5: number;
  entities: number;
  observations: string;
}

export interface BcraVariable {
  id: string;
  code: string;
  name: string;
  value: number;
  unit: "%" | "bps" | "index";
  asOf: string;
  previous: number;
  source: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  version: string;
  productId: string | null;
  status: "draft" | "active" | "archived";
  updatedAt: string;
  clauses: number;
}

export interface SupportTicket {
  id: string;
  clientId: string | null;
  subject: string;
  channel: "email" | "whatsapp" | "telefono" | "interno";
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  messages: number;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
}

export interface AppConfig {
  companyName: string;
  cuit: string;
  timezone: string;
  locale: "es-AR";
  currency: "ARS";
  manualDisbursement: boolean;
  punitiveInterest: boolean;
  kycProvider: "didit";
  mpCollectorId: string;
  supportEmail: string;
  collectionsSlaHours: number;
}

export interface DashboardSnapshot {
  pendingApplications: number;
  pendingKyc: number;
  pendingDisbursements: number;
  transfersToReview: number;
  inArrears: number;
  activePortfolio: number;
  activeCredits: number;
  avgTicket: number;
  moraRate: number;
  collectedMtd: number;
  disbursedMtd: number;
  approvalRate: number;
}

export interface DailyPoint {
  date: string;
  solicitudes: number;
  aprobadas: number;
  rechazadas: number;
  cobrado: number;
  desembolsado: number;
}

export type AdminState = {
  products: CreditProduct[];
  operators: Operator[];
  merchants: Merchant[];
  clients: Client[];
  kyc: KycCase[];
  applications: LoanApplication[];
  credits: Credit[];
  payments: Payment[];
  disbursements: Disbursement[];
  collections: CollectionCase[];
  approvals: Approval[];
  receipts: Receipt[];
  accounts: BankAccount[];
  ledger: LedgerEntry[];
  cendeu: CendeuReport[];
  bcra: BcraVariable[];
  contracts: ContractTemplate[];
  tickets: SupportTicket[];
  audit: AuditEvent[];
  config: AppConfig;
  series: DailyPoint[];
};
