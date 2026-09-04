import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const ts = () => timestamp('createdAt', { withTimezone: true })
const tsUpdated = () => timestamp('updatedAt', { withTimezone: true })
const tsCol = (name: string) => timestamp(name, { withTimezone: true })

/* ----------------------------- Better Auth ----------------------------- */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  username: text('username'),
  phoneNumber: text('phoneNumber'),
  phoneNumberVerified: boolean('phoneNumberVerified').default(false),
  banned: boolean('banned').default(false),
  twoFactorEnabled: boolean('twoFactorEnabled').default(false),
  role: text('role').notNull().default('customer'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: tsCol('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  impersonatedBy: text('impersonatedBy'),
  activeOrganizationId: text('activeOrganizationId'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: tsCol('accessTokenExpiresAt'),
  refreshTokenExpiresAt: tsCol('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  issuer: text('issuer'),
  accountType: text('accountType'),
  claims: jsonb('claims'),
  params: jsonb('params'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  uniqueIndex('account_provider_account_unique').on(t.providerId, t.accountId),
])

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: tsCol('expiresAt').notNull(),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/* ------------------------------ UniCred ------------------------------- */

export const profile = pgTable('profile', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('customer'),
  adminRoleId: text('adminRoleId').references(() => adminRole.id, { onDelete: 'set null' }),
  cuil: text('cuil'),
  dni: text('dni'),
  phone: text('phone'),
  birthDate: text('birthDate'),
  province: text('province'),
  department: text('department'),
  city: text('city'),
  postalCode: text('postalCode'),
  address: text('address'),
  monthlyIncome: numeric('monthlyIncome', { precision: 14, scale: 2 }),
  employmentStatus: text('employmentStatus'),
  kycStatus: text('kycStatus').notNull().default('pending'),
  creditScore: integer('creditScore'),
  bcraConsentAt: tsCol('bcraConsentAt'),
  bcraConsentIp: text('bcraConsentIp'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/* ----------------------------- RBAC (admin) ----------------------------- */

/** Roles con nombre para la mesa admin. No confundir con profile.role (customer/merchant/admin): esto sub-clasifica a los admin. */
export const adminRole = pgTable('admin_role', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  isSystem: boolean('isSystem').notNull().default(false),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/** Catálogo fijo de capacidades verificables server-side. No editable desde la UI. */
export const adminPermission = pgTable('admin_permission', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(),
  createdAt: ts().notNull().defaultNow(),
})

export const adminRolePermission = pgTable('admin_role_permission', {
  id: text('id').primaryKey(),
  roleId: text('roleId').notNull().references(() => adminRole.id, { onDelete: 'cascade' }),
  permissionId: text('permissionId').notNull().references(() => adminPermission.id, { onDelete: 'cascade' }),
}, (t) => [
  uniqueIndex('admin_role_permission_unique').on(t.roleId, t.permissionId),
  index('admin_role_permission_role_idx').on(t.roleId),
])

/**
 * Parámetros de underwriting versionados. No es un motor de reglas genérico:
 * son los mismos umbrales que ya usaba el código (lib/loan-underwriting.ts),
 * movidos a la base para que Riesgo los pueda ajustar sin deploy, con
 * historial y auditoría. Solo una fila activa a la vez.
 */
export const riskRuleVersion = pgTable('risk_rule_version', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  isActive: boolean('isActive').notNull().default(false),
  scoreRejectBelow: integer('scoreRejectBelow').notNull(),
  scoreAutoQualifyAt: integer('scoreAutoQualifyAt').notNull(),
  incomeDtiRatio: numeric('incomeDtiRatio', { precision: 5, scale: 4 }).notNull(),
  firstCreditHardCap: numeric('firstCreditHardCap', { precision: 14, scale: 2 }).notNull(),
  bcraWorstSituationRejectAt: integer('bcraWorstSituationRejectAt').notNull(),
  bcraRejectedChecksSituationThreshold: integer('bcraRejectedChecksSituationThreshold').notNull(),
  notes: text('notes'),
  createdBy: text('createdBy').references(() => user.id, { onDelete: 'set null' }),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('risk_rule_version_active_idx').on(t.isActive),
])

export const merchant = pgTable('merchant', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  businessName: text('businessName').notNull(),
  cuit: text('cuit').notNull().unique(),
  category: text('category'),
  province: text('province'),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  status: text('status').notNull().default('pending'),
  personType: text('personType'),
  taxCondition: text('taxCondition'),
  taxStatus: text('taxStatus'),
  legalName: text('legalName'),
  monotributoCategory: text('monotributoCategory'),
  titularMatch: text('titularMatch'),
  representativeRole: text('representativeRole').notNull().default('titular'),
  kybStatus: text('kybStatus').notNull().default('incomplete'),
  kybBlockers: jsonb('kybBlockers').$type<string[]>(),
  afipSnapshot: jsonb('afipSnapshot'),
  afipLookedUpAt: tsCol('afipLookedUpAt'),
  commissionRate: numeric('commissionRate', { precision: 5, scale: 2 })
    .notNull()
    .default('8.00'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

export const merchantDocument = pgTable('merchant_document', {
  id: text('id').primaryKey(),
  merchantId: text('merchantId').notNull().references(() => merchant.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  fileName: text('fileName').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('uploaded'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('merchant_document_merchant_idx').on(t.merchantId),
])

export const loanProduct = pgTable('loan_product', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('personal'),
  minAmount: numeric('minAmount', { precision: 14, scale: 2 }).notNull(),
  maxAmount: numeric('maxAmount', { precision: 14, scale: 2 }).notNull(),
  minTerm: integer('minTerm').notNull(),
  maxTerm: integer('maxTerm').notNull(),
  monthlyRate: numeric('monthlyRate', { precision: 6, scale: 3 }).notNull(),
  tna: numeric('tna', { precision: 6, scale: 3 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts().notNull().defaultNow(),
})

export const loan = pgTable('loan', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  productId: text('productId').references(() => loanProduct.id),
  merchantId: text('merchantId').references(() => merchant.id),
  type: text('type').notNull().default('personal'),
  principal: numeric('principal', { precision: 14, scale: 2 }).notNull(),
  term: integer('term').notNull(),
  monthlyRate: numeric('monthlyRate', { precision: 6, scale: 3 }).notNull(),
  tna: numeric('tna', { precision: 6, scale: 3 }).notNull(),
  tea: numeric('tea', { precision: 6, scale: 3 }),
  installmentAmount: numeric('installmentAmount', {
    precision: 14,
    scale: 2,
  }).notNull(),
  totalAmount: numeric('totalAmount', { precision: 14, scale: 2 }).notNull(),
  cft: numeric('cft', { precision: 6, scale: 3 }),
  status: text('status').notNull().default('pending'),
  purpose: text('purpose'),
  scoreAtApproval: integer('scoreAtApproval'),
  rejectionReason: text('rejectionReason'),
  disbursedAt: tsCol('disbursedAt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('loan_user_idx').on(t.userId),
  index('loan_status_idx').on(t.status),
])

export const installment = pgTable('installment', {
  id: text('id').primaryKey(),
  loanId: text('loanId').notNull().references(() => loan.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  dueDate: tsCol('dueDate').notNull(),
  status: text('status').notNull().default('pending'),
  paidAt: tsCol('paidAt'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  uniqueIndex('installment_loan_number_unique').on(t.loanId, t.number),
  index('installment_user_idx').on(t.userId),
  index('installment_status_idx').on(t.status),
  index('installment_due_idx').on(t.dueDate),
])

export const bcraCheck = pgTable('bcra_check', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  cuil: text('cuil').notNull(),
  worstSituation: integer('worstSituation'),
  totalDebt: numeric('totalDebt', { precision: 14, scale: 2 }),
  entitiesCount: integer('entitiesCount'),
  hasRejectedChecks: boolean('hasRejectedChecks').default(false),
  rawResult: jsonb('rawResult'),
  source: text('source').default('bcra_api'),
  rawResponse: jsonb('rawResponse'),
  consultedAt: tsCol('consultedAt'),
  computedScore: integer('computedScore'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('bcra_check_user_idx').on(t.userId),
])

/* --------------------------- KYC y Verificación -------------------------- */

export const kycVerification = pgTable('kyc_verification', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  dniFrontImageUrl: text('dniFrontImageUrl'),
  dniBackImageUrl: text('dniBackImageUrl'),
  selfieImageUrl: text('selfieImageUrl'),
  videoUrl: text('videoUrl'),
  dniNumber: text('dniNumber'),
  cuilVerified: boolean('cuilVerified').default(false),
  phoneVerified: boolean('phoneVerified').default(false),
  emailVerified: boolean('emailVerified').default(false),
  verificationLevel: text('verificationLevel').notNull().default('none'),
  status: text('status').notNull().default('pending'),
  provider: text('provider'),
  providerReferenceId: text('providerReferenceId'),
  rejectionReason: text('rejectionReason'),
  reviewedBy: text('reviewedBy'),
  reviewedAt: tsCol('reviewedAt'),
  ocrData: jsonb('ocrData'),
  faceMatchScore: numeric('faceMatchScore', { precision: 5, scale: 2 }),
  expiresAt: tsCol('expiresAt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/** Sesiones Didit: alta pendiente (sin userId) y resultado del webhook. */
export const diditSession = pgTable('didit_session', {
  id: text('id').primaryKey(),
  sessionId: text('sessionId').notNull().unique(),
  vendorData: text('vendorData').notNull(),
  userId: text('userId').references(() => user.id, { onDelete: 'set null' }),
  workflowId: text('workflowId'),
  status: text('status').notNull().default('Not Started'),
  webhookEventId: text('webhookEventId'),
  decision: jsonb('decision'),
  verificationUrl: text('verificationUrl'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('didit_session_user_idx').on(t.userId),
  index('didit_session_vendor_idx').on(t.vendorData),
])

export const diditWebhookLog = pgTable('didit_webhook_log', {
  id: text('id').primaryKey(),
  eventId: text('eventId').notNull().unique(),
  dedupeKey: text('dedupeKey'),
  webhookType: text('webhookType').notNull(),
  sessionId: text('sessionId'),
  status: text('status'),
  environment: text('environment'),
  processed: boolean('processed').notNull().default(false),
  payload: jsonb('payload'),
  createdAt: ts().notNull().defaultNow(),
  processedAt: tsCol('processedAt'),
}, (t) => [
  index('didit_webhook_log_session_idx').on(t.sessionId),
  index('didit_webhook_log_type_idx').on(t.webhookType),
  uniqueIndex('didit_webhook_log_dedupe_unique').on(t.dedupeKey),
])

/* ---------------------- Datos Bancarios y Acreditación -------------------- */

export const bankAccount = pgTable('bank_account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountType: text('accountType').notNull().default('cbu'),
  bankName: text('bankName').notNull(),
  accountNumber: text('accountNumber'),
  cbu: text('cbu'),
  cvu: text('cvu'),
  alias: text('alias'),
  holderName: text('holderName').notNull(),
  holderCuil: text('holderCuil').notNull(),
  holderDocumentType: text('holderDocumentType').default('DNI'),
  holderDocumentNumber: text('holderDocumentNumber'),
  isVerified: boolean('isVerified').notNull().default(false),
  verificationMethod: text('verificationMethod'),
  verificationCodeSentAt: tsCol('verificationCodeSentAt'),
  verificationAttempts: integer('verificationAttempts').default(0),
  verificationData: jsonb('verificationData'),
  verifiedBy: text('verifiedBy'),
  verifiedAt: tsCol('verifiedAt'),
  isPrimary: boolean('isPrimary').notNull().default(true),
  isActive: boolean('isActive').notNull().default(true),
  bankCode: text('bankCode'),
  branch: text('branch'),
  scheme: text('scheme'),
  currency: text('currency').notNull().default('ARS'),
  networkStatus: text('networkStatus'),
  networkBlocked: boolean('networkBlocked').notNull().default(false),
  extractedProfile: jsonb('extractedProfile'),
  extractedAt: tsCol('extractedAt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('bank_account_user_idx').on(t.userId),
  uniqueIndex('bank_account_primary_unique').on(t.userId).where(sql`${t.isPrimary} = true`),
])

/* ---------------- Desembolsos / Acreditación en Cuenta -------------------- */

export const disbursement = pgTable('disbursement', {
  id: text('id').primaryKey(),
  loanId: text('loanId').notNull().unique().references(() => loan.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  bankAccountId: text('bankAccountId').references(() => bankAccount.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  status: text('status').notNull().default('pending'),
  disbursementMethod: text('disbursementMethod').notNull().default('bank_transfer'),
  referenceNumber: text('referenceNumber'),
  externalId: text('externalId'),
  receiptNumber: text('receiptNumber').notNull().unique(),
  proofUrl: text('proofUrl'),
  netAmount: numeric('netAmount', { precision: 14, scale: 2 }),
  fees: numeric('fees', { precision: 14, scale: 2 }).default('0'),
  taxes: numeric('taxes', { precision: 14, scale: 2 }).default('0'),
  failureReason: text('failureReason'),
  expectedDate: tsCol('expectedDate'),
  creditedAt: tsCol('creditedAt'),
  processedBy: text('processedBy'),
  notes: text('notes'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('disbursement_user_idx').on(t.userId),
  index('disbursement_status_idx').on(t.status),
])

/* --------------------------- Contratos de Préstamo ------------------------ */

export const loanContract = pgTable('loan_contract', {
  id: text('id').primaryKey(),
  loanId: text('loanId').notNull().unique().references(() => loan.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  version: text('version').notNull().default('1.0'),
  templateName: text('templateName').notNull().default('prestamo_personal_ars'),
  contentHash: text('contentHash'),
  status: text('status').notNull().default('generated'),
  documentUrl: text('documentUrl'),
  acceptedAt: tsCol('acceptedAt'),
  rejectedAt: tsCol('rejectedAt'),
  rejectedReason: text('rejectedReason'),
  acceptedIp: text('acceptedIp'),
  acceptedUserAgent: text('acceptedUserAgent'),
  signatureType: text('signatureType').default('clickwrap'),
  signatureData: jsonb('signatureData'),
  signerName: text('signerName'),
  signerCuil: text('signerCuil'),
  generatedBy: text('generatedBy'),
  effectiveDate: tsCol('effectiveDate'),
  expirationDate: tsCol('expirationDate'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/* --------------------------- Informes BCRA Imprimibles -------------------- */

export const bcraReport = pgTable('bcra_report', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  bcraCheckId: text('bcraCheckId').notNull().references(() => bcraCheck.id),
  reportNumber: text('reportNumber').notNull().unique(),
  generatedBy: text('generatedBy'),
  scoreAtGeneration: integer('scoreAtGeneration'),
  worstSituation: integer('worstSituation'),
  totalDebt: numeric('totalDebt', { precision: 14, scale: 2 }),
  entitiesCount: integer('entitiesCount'),
  hasRejectedChecks: boolean('hasRejectedChecks').default(false),
  currency: text('currency').notNull().default('ARS'),
  branding: jsonb('branding').default({ company: 'UNICRÉDITOS', logoUrl: '/logo.svg', theme: 'default' }),
  fullReportData: jsonb('fullReportData'),
  documentUrl: text('documentUrl'),
  downloadedAt: tsCol('downloadedAt'),
  downloadCount: integer('downloadCount').default(0),
  expiresAt: tsCol('expiresAt'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('bcra_report_user_idx').on(t.userId),
])

/* ---------------------------------- Pagos ---------------------------------- */

export const payment = pgTable('payment', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  installmentId: text('installmentId').references(() => installment.id),
  loanId: text('loanId').references(() => loan.id),
  merchantId: text('merchantId').references(() => merchant.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  status: text('status').notNull().default('pending'),
  method: text('method').notNull().default('transferencia_bancaria'),
  source: text('source').notNull().default('web'),
  externalId: text('externalId'),
  referenceNumber: text('referenceNumber'),
  paymentLinkId: text('paymentLinkId'),
  paymentLinkUrl: text('paymentLinkUrl'),
  netAmount: numeric('netAmount', { precision: 14, scale: 2 }),
  fees: numeric('fees', { precision: 14, scale: 2 }).default('0'),
  taxes: numeric('taxes', { precision: 14, scale: 2 }).default('0'),
  gateway: text('gateway'),
  gatewayResponse: jsonb('gatewayResponse'),
  failureReason: text('failureReason'),
  refundReason: text('refundReason'),
  paidAt: tsCol('paidAt'),
  refundedAt: tsCol('refundedAt'),
  expiresAt: tsCol('expiresAt'),
  processedBy: text('processedBy'),
  notes: text('notes'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('payment_user_idx').on(t.userId),
  index('payment_status_idx').on(t.status),
  index('payment_external_idx').on(t.externalId),
  // Un pago del gateway (ej. Mercado Pago) no puede acreditarse dos veces.
  uniqueIndex('payment_external_unique').on(t.externalId).where(sql`${t.externalId} is not null`),
])

/* ------------------------------- Comprobantes / Recibos -------------------- */

export const paymentReceipt = pgTable('payment_receipt', {
  id: text('id').primaryKey(),
  receiptNumber: text('receiptNumber').notNull().unique(),
  receiptType: text('receiptType').notNull().default('payment'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  paymentId: text('paymentId').references(() => payment.id),
  disbursementId: text('disbursementId').references(() => disbursement.id),
  loanId: text('loanId').references(() => loan.id),
  installmentId: text('installmentId').references(() => installment.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  loanSnapshot: jsonb('loanSnapshot'),
  installmentSnapshot: jsonb('installmentSnapshot'),
  previousBalance: numeric('previousBalance', { precision: 14, scale: 2 }),
  newBalance: numeric('newBalance', { precision: 14, scale: 2 }),
  pendingInstallments: integer('pendingInstallments'),
  totalPaidToDate: numeric('totalPaidToDate', { precision: 14, scale: 2 }),
  customerSnapshot: jsonb('customerSnapshot'),
  bankAccountSnapshot: jsonb('bankAccountSnapshot'),
  method: text('method'),
  referenceNumber: text('referenceNumber'),
  issuedAt: tsCol('issuedAt').notNull().defaultNow(),
  paidAt: tsCol('paidAt'),
  validUntil: tsCol('validUntil'),
  documentUrl: text('documentUrl'),
  downloadCount: integer('downloadCount').default(0),
  viewedAt: tsCol('viewedAt'),
  sentByEmail: boolean('sentByEmail').default(false),
  sentAt: tsCol('sentAt'),
  branding: jsonb('branding').default({ company: 'UNICRÉDITOS', cuit: null, address: null, logoUrl: '/logo.svg', qrEnabled: true }),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('payment_receipt_user_idx').on(t.userId),
])

/** Factura electrónica ARCA (WsFE) del IVA sobre intereses de cada cuota. */
export const arcaInvoice = pgTable('arca_invoice', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  loanId: text('loanId').references(() => loan.id, { onDelete: 'set null' }),
  installmentId: text('installmentId').references(() => installment.id, { onDelete: 'set null' }),
  cbteTipo: integer('cbteTipo').notNull().default(6),
  ptoVta: integer('ptoVta').notNull().default(1),
  cbteNro: integer('cbteNro'),
  docTipo: integer('docTipo').notNull().default(80),
  docNro: text('docNro').notNull(),
  impNeto: numeric('impNeto', { precision: 14, scale: 2 }).notNull(),
  impIva: numeric('impIva', { precision: 14, scale: 2 }).notNull(),
  impTotal: numeric('impTotal', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  status: text('status').notNull().default('pending_cae'),
  cae: text('cae'),
  caeVto: text('caeVto'),
  arcaError: text('arcaError'),
  issuedAt: tsCol('issuedAt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('arca_invoice_user_idx').on(t.userId),
  uniqueIndex('arca_invoice_installment_unique').on(t.installmentId),
])

/* -------------------------- Métodos de Pago Guardados --------------------- */

export const savedPaymentMethod = pgTable('saved_payment_method', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  brand: text('brand'),
  nickname: text('nickname'),
  isDefault: boolean('isDefault').notNull().default(false),
  isActive: boolean('isActive').notNull().default(true),
  last4: text('last4'),
  expirationMonth: integer('expirationMonth'),
  expirationYear: integer('expirationYear'),
  cardholderName: text('cardholderName'),
  cardholderDocument: text('cardholderDocument'),
  gateway: text('gateway'),
  gatewayCustomerId: text('gatewayCustomerId'),
  gatewayPaymentMethodId: text('gatewayPaymentMethodId'),
  cvu: text('cvu'),
  alias: text('alias'),
  cbu: text('cbu'),
  walletName: text('walletName'),
  firstUsedAt: tsCol('firstUsedAt'),
  lastUsedAt: tsCol('lastUsedAt'),
  usageCount: integer('usageCount').default(0),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('saved_payment_user_idx').on(t.userId),
  uniqueIndex('saved_payment_default_unique').on(t.userId).where(sql`${t.isDefault} = true`),
])

/* ------------------------- Variables BCRA (override manual) ------------------------ */

export const bcraVariable = pgTable('bcra_variable', {
  id: text('id').primaryKey(),
  idVariable: text('idVariable').notNull().unique(),
  variableName: text('variableName').notNull(),
  value: numeric('value', { precision: 18, scale: 4 }).notNull(),
  effectiveDate: tsCol('effectiveDate'),
  manualOverride: boolean('manualOverride').notNull().default(false),
  overrideNote: text('overrideNote'),
  updatedBy: text('updatedBy'),
  source: text('source').notNull().default('bcra_api'),
  rawPayload: jsonb('rawPayload'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
})

/* ---------------- Directorio CBU/CVU/alias (validación de desembolso) ---------------- */

export const bankDirectory = pgTable('bank_directory', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  identifierType: text('identifierType').notNull(),
  cbu: text('cbu'),
  cvu: text('cvu'),
  alias: text('alias'),
  bankName: text('bankName'),
  bankCode: text('bankCode'),
  entityName: text('entityName'),
  branch: text('branch'),
  holderName: text('holderName'),
  taxId: text('taxId'),
  taxIdType: text('taxIdType'),
  accountNumber: text('accountNumber'),
  accountType: text('accountType'),
  scheme: text('scheme'),
  currency: text('currency').notNull().default('ARS'),
  active: boolean('active'),
  blocked: boolean('blocked').notNull().default(false),
  rawPayload: jsonb('rawPayload'),
  source: text('source').notNull().default('unicred_lookup'),
  lookedUpAt: tsCol('lookedUpAt').notNull().defaultNow(),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  uniqueIndex('bank_directory_ident_unique').on(t.identifierType, t.identifier),
  index('bank_directory_tax_idx').on(t.taxId),
  index('bank_directory_cbu_idx').on(t.cbu),
])

export const supportCase = pgTable('support_case', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'),
  channel: text('channel').notNull().default('dashboard'),
  lawRef: text('lawRef').notNull().default('Ley 24.240'),
  response: text('response'),
  respondedAt: tsCol('respondedAt'),
  assignedAdminId: text('assignedAdminId'),
  relatedLoanId: text('relatedLoanId'),
  waitingOn: text('waitingOn').notNull().default('agent'),
  lastMessageAt: tsCol('lastMessageAt'),
  lastAgentSeenAt: tsCol('lastAgentSeenAt'),
  lastCustomerSeenAt: tsCol('lastCustomerSeenAt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('support_case_user_idx').on(t.userId),
  index('support_case_status_idx').on(t.status),
])

export const supportMessage = pgTable('support_message', {
  id: text('id').primaryKey(),
  caseId: text('caseId').notNull().references(() => supportCase.id, { onDelete: 'cascade' }),
  authorUserId: text('authorUserId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  authorRole: text('authorRole').notNull(),
  body: text('body').notNull(),
  kind: text('kind').notNull().default('message'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('support_message_case_idx').on(t.caseId),
])

export const supportPresence = pgTable('support_presence', {
  userId: text('userId').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  viewingCaseId: text('viewingCaseId'),
  lastSeenAt: tsCol('lastSeenAt').notNull().defaultNow(),
})

export const inboxReceipt = pgTable('inbox_receipt', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  itemId: text('itemId').notNull(),
  readAt: tsCol('readAt').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('inbox_receipt_user_item_unique').on(t.userId, t.itemId),
  index('inbox_receipt_user_idx').on(t.userId),
])

/* -------------------- Billetera virtual Payway / Prisma ------------------- */

export const walletAccount = pgTable('wallet_account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  cvu: text('cvu').notNull().unique(),
  alias: text('alias').notNull().unique(),
  holderName: text('holderName'),
  taxId: text('taxId'),
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('ARS'),
  /** Ledger propio; el riel externo (payway / pomelo / treasury) es solo ejecución. */
  provider: text('provider').notNull().default('unicred'),
  paywayAccountId: text('paywayAccountId'),
  pomeloAccountId: text('pomeloAccountId'),
  liveAttempt: jsonb('liveAttempt'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('wallet_account_cvu_idx').on(t.cvu),
  index('wallet_account_alias_idx').on(t.alias),
])

export const walletMovement = pgTable('wallet_movement', {
  id: text('id').primaryKey(),
  walletId: text('walletId').notNull().references(() => walletAccount.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  direction: text('direction').notNull(),
  kind: text('kind').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric('balanceAfter', { precision: 14, scale: 2 }).notNull(),
  paymentId: text('paymentId').references(() => payment.id, { onDelete: 'set null' }),
  payoutId: text('payoutId'),
  counterpartyUserId: text('counterpartyUserId'),
  externalId: text('externalId'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('wallet_movement_wallet_idx').on(t.walletId),
  index('wallet_movement_user_idx').on(t.userId),
  uniqueIndex('wallet_movement_external_unique').on(t.externalId).where(sql`${t.externalId} is not null`),
])

/**
 * Órdenes de egreso a CBU/CVU externos.
 * El saldo del cliente ya se debitó en el ledger UNICRÉDITOS;
 * tesorería RM (o Payway/Pomelo) ejecuta la transferencia bancaria.
 */
export const walletPayout = pgTable('wallet_payout', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  walletId: text('walletId').notNull().references(() => walletAccount.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  destinationKind: text('destinationKind').notNull(),
  destinationValue: text('destinationValue').notNull(),
  concept: text('concept'),
  reference: text('reference').notNull(),
  treasuryCbu: text('treasuryCbu').notNull(),
  rail: text('rail').notNull().default('treasury_rm'),
  providerPayload: jsonb('providerPayload'),
  executedAt: tsCol('executedAt'),
  executedBy: text('executedBy'),
  failureReason: text('failureReason'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('wallet_payout_user_idx').on(t.userId),
  index('wallet_payout_status_idx').on(t.status),
  uniqueIndex('wallet_payout_reference_unique').on(t.reference),
])

/**
 * Pagos de servicios y recargas debitados de la billetera UNICRÉDITOS.
 * Tesorería RM liquida al prestador (mismo patrón que wallet_payout).
 */
export const servicePayment = pgTable('service_payment', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  walletId: text('walletId').notNull().references(() => walletAccount.id, { onDelete: 'cascade' }),
  providerId: text('providerId').notNull(),
  providerName: text('providerName').notNull(),
  category: text('category').notNull(),
  kind: text('kind').notNull(),
  accountRef: text('accountRef').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  status: text('status').notNull().default('queued'),
  reference: text('reference').notNull(),
  movementId: text('movementId'),
  providerPayload: jsonb('providerPayload'),
  executedAt: tsCol('executedAt'),
  failureReason: text('failureReason'),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: tsUpdated().notNull().defaultNow(),
}, (t) => [
  index('service_payment_user_idx').on(t.userId),
  index('service_payment_status_idx').on(t.status),
  uniqueIndex('service_payment_reference_unique').on(t.reference),
])

/**
 * Rastro de toda intervención manual de administración: quién tocó qué, cuándo
 * y con qué valores. Es append-only: nada del producto actualiza ni borra filas
 * de esta tabla.
 */
export const adminAuditLog = pgTable('admin_audit_log', {
  id: text('id').primaryKey(),
  actorUserId: text('actorUserId').references(() => user.id, { onDelete: 'set null' }),
  actorEmail: text('actorEmail'),
  action: text('action').notNull(),
  entityType: text('entityType').notNull(),
  entityId: text('entityId'),
  targetUserId: text('targetUserId'),
  severity: text('severity').notNull().default('info'),
  summary: text('summary').notNull(),
  changes: jsonb('changes'),
  createdAt: ts().notNull().defaultNow(),
}, (t) => [
  index('admin_audit_log_created_idx').on(t.createdAt),
  index('admin_audit_log_actor_idx').on(t.actorUserId),
  index('admin_audit_log_entity_idx').on(t.entityType, t.entityId),
])
