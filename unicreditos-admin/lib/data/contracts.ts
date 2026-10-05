import type {
  AdminState,
  Approval,
  AppConfig,
  BankAccount,
  BcraVariable,
  CendeuReport,
  Client,
  CollectionCase,
  ContractTemplate,
  Credit,
  CreditProduct,
  DashboardSnapshot,
  Disbursement,
  KycCase,
  LedgerEntry,
  LoanApplication,
  Merchant,
  Operator,
  Payment,
  Receipt,
  SupportTicket,
} from "@/lib/domain/types";

export type ApproveInput = {
  applicationId: string;
  operatorId: string;
  comment: string;
};

export type RejectInput = {
  applicationId: string;
  operatorId: string;
  comment: string;
};

export type RegisterPaymentInput = {
  creditId: string;
  amount: number;
  channel: "mercadopago" | "transferencia";
  operatorId: string;
  notes?: string;
};

export type DisburseInput = {
  disbursementId: string;
  operatorId: string;
  reference: string;
};

export type MatchTransferInput = {
  paymentId: string;
  operatorId: string;
};

export type KycDecisionInput = {
  kycId: string;
  operatorId: string;
  status: "verified" | "rejected";
  notes: string;
};

export type CreateApplicationInput = {
  clientId: string;
  productId: string;
  merchantId?: string | null;
  amount: number;
  installments: number;
  purpose: string;
};

export interface AdminDataSource {
  getState(): AdminState;
  subscribe(listener: () => void): () => void;

  dashboard(): DashboardSnapshot;
  getClient(id: string): Client | undefined;
  getCredit(id: string): Credit | undefined;
  getApplication(id: string): LoanApplication | undefined;
  getMerchant(id: string): Merchant | undefined;
  getPayment(id: string): Payment | undefined;

  createApplication(input: CreateApplicationInput): Promise<void>;
  approveApplication(input: ApproveInput): void;
  rejectApplication(input: RejectInput): void;
  cancelApplication(id: string, operatorId: string, reason: string): void;
  decideKyc(input: KycDecisionInput): void;
  markDisbursed(input: DisburseInput): void;
  registerPayment(input: RegisterPaymentInput): void;
  matchTransfer(input: MatchTransferInput): void;
  rejectTransfer(paymentId: string, operatorId: string, reason: string): void;
  logCollectionContact(caseId: string, operatorId: string, note: string): void;
  updateConfig(patch: Partial<AppConfig>): void;
  resolveTicket(id: string, operatorId: string): void;
  pauseMerchant(id: string, operatorId: string): void;
  activateMerchant(id: string, operatorId: string): void;
}

export type {
  AdminState,
  Approval,
  BankAccount,
  BcraVariable,
  CendeuReport,
  Client,
  CollectionCase,
  ContractTemplate,
  Credit,
  CreditProduct,
  Disbursement,
  KycCase,
  LedgerEntry,
  LoanApplication,
  Merchant,
  Operator,
  Payment,
  Receipt,
  SupportTicket,
};
