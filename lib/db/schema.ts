import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/* ----------------------------- Better Auth ----------------------------- */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
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
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

/* ------------------------------ UniCred ------------------------------- */

// role: 'customer' | 'merchant' | 'admin'
export const profile = pgTable('profile', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  role: text('role').notNull().default('customer'),
  cuil: text('cuil'),
  dni: text('dni'),
  phone: text('phone'),
  birthDate: text('birthDate'),
  province: text('province'),
  city: text('city'),
  address: text('address'),
  monthlyIncome: numeric('monthlyIncome', { precision: 14, scale: 2 }),
  employmentStatus: text('employmentStatus'),
  kycStatus: text('kycStatus').notNull().default('pending'),
  creditScore: integer('creditScore'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// status: 'pending' | 'active' | 'rejected'
export const merchant = pgTable('merchant', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  businessName: text('businessName').notNull(),
  cuit: text('cuit').notNull(),
  category: text('category'),
  province: text('province'),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  status: text('status').notNull().default('pending'),
  commissionRate: numeric('commissionRate', { precision: 5, scale: 2 })
    .notNull()
    .default('8.00'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

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
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// status: 'pending' | 'approved' | 'rejected' | 'active' | 'paid'
export const loan = pgTable('loan', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  productId: text('productId'),
  merchantId: text('merchantId'),
  type: text('type').notNull().default('personal'),
  principal: numeric('principal', { precision: 14, scale: 2 }).notNull(),
  term: integer('term').notNull(),
  monthlyRate: numeric('monthlyRate', { precision: 6, scale: 3 }).notNull(),
  tna: numeric('tna', { precision: 6, scale: 3 }).notNull(),
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
  disbursedAt: timestamp('disbursedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// status: 'pending' | 'paid' | 'overdue'
export const installment = pgTable('installment', {
  id: text('id').primaryKey(),
  loanId: text('loanId').notNull(),
  userId: text('userId').notNull(),
  number: integer('number').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  dueDate: timestamp('dueDate').notNull(),
  status: text('status').notNull().default('pending'),
  paidAt: timestamp('paidAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const bcraCheck = pgTable('bcra_check', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  cuil: text('cuil').notNull(),
  worstSituation: integer('worstSituation'),
  totalDebt: numeric('totalDebt', { precision: 14, scale: 2 }),
  entitiesCount: integer('entitiesCount'),
  hasRejectedChecks: boolean('hasRejectedChecks').default(false),
  rawResult: jsonb('rawResult'),
  computedScore: integer('computedScore'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
