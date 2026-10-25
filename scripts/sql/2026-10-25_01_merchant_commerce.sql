-- Venta financiada en comercios: catálogo, operaciones con anticipo del 30%, liquidaciones semanales
-- y cuenta de cobro. Aditivo e idempotente. Misma fuente que lib/merchant-commerce-ddl.ts
-- (ensureMerchantCommerceSchema lo aplica solo en el primer uso).
BEGIN;
CREATE TABLE IF NOT EXISTS merchant_product (
    id text PRIMARY KEY,
    "merchantId" text NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
    sku text,
    name text NOT NULL,
    description text,
    category text,
    price numeric(14,2) NOT NULL CONSTRAINT merchant_product_price_check CHECK (price > 0),
    stock integer CONSTRAINT merchant_product_stock_check CHECK (stock IS NULL OR stock >= 0),
    image text,
    active boolean NOT NULL DEFAULT true,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS merchant_product_merchant_idx ON merchant_product ("merchantId", active);

CREATE TABLE IF NOT EXISTS merchant_settlement (
    id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    "merchantId" text NOT NULL REFERENCES merchant(id) ON DELETE RESTRICT,
    "payDate" text NOT NULL,
    status text NOT NULL DEFAULT 'scheduled' CONSTRAINT merchant_settlement_status_check CHECK (status IN ('scheduled','paid')),
    "orderCount" integer NOT NULL DEFAULT 0,
    "grossAmount" numeric(14,2) NOT NULL DEFAULT 0,
    "downPaymentsAmount" numeric(14,2) NOT NULL DEFAULT 0,
    "financedAmount" numeric(14,2) NOT NULL DEFAULT 0,
    "commissionAmount" numeric(14,2) NOT NULL DEFAULT 0,
    "netAmount" numeric(14,2) NOT NULL DEFAULT 0,
    "payoutCbu" text,
    "payoutHolder" text,
    "transferReference" text,
    "paidAt" timestamptz,
    "paidBy" text,
    notes text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  );

CREATE UNIQUE INDEX IF NOT EXISTS merchant_settlement_merchant_date_unique ON merchant_settlement ("merchantId", "payDate");

CREATE INDEX IF NOT EXISTS merchant_settlement_date_idx ON merchant_settlement ("payDate", status);

CREATE TABLE IF NOT EXISTS merchant_order (
    id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    "merchantId" text NOT NULL REFERENCES merchant(id) ON DELETE RESTRICT,
    "customerUserId" text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    "loanId" text NOT NULL UNIQUE REFERENCES loan(id) ON DELETE RESTRICT,
    origin text NOT NULL DEFAULT 'local' CONSTRAINT merchant_order_origin_check CHECK (origin IN ('local','online')),
    items jsonb NOT NULL,
    "totalAmount" numeric(14,2) NOT NULL CONSTRAINT "merchant_order_totalAmount_check" CHECK ("totalAmount" > 0),
    "downPaymentRate" numeric(5,4) NOT NULL,
    "downPaymentAmount" numeric(14,2) NOT NULL,
    "financedAmount" numeric(14,2) NOT NULL,
    "commissionRate" numeric(5,2) NOT NULL,
    "commissionAmount" numeric(14,2) NOT NULL,
    "netAmount" numeric(14,2) NOT NULL,
    "downPaymentStatus" text NOT NULL DEFAULT 'pending' CONSTRAINT "merchant_order_downPaymentStatus_check" CHECK ("downPaymentStatus" IN ('pending','reported','confirmed','rejected')),
    "downPaymentMethod" text,
    "downPaymentReference" text,
    "downPaymentProof" text,
    "downPaymentReportedAt" timestamptz,
    "downPaidAt" timestamptz,
    "downPaymentReviewedBy" text,
    "downPaymentNote" text,
    "mpOrderId" text,
    "mpExternalRef" text,
    "mpQrData" text,
    "mpQrExpiresAt" timestamptz,
    "mpPaymentId" text,
    "deliveryCode" text NOT NULL,
    "deliveredAt" timestamptz,
    "deliveredBy" text,
    "deliveryNote" text,
    "settlementId" text REFERENCES merchant_settlement(id) ON DELETE SET NULL,
    "cancelledAt" timestamptz,
    "cancelledBy" text,
    "cancelReason" text,
    "createdBy" text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT merchant_order_split_ok CHECK ("downPaymentAmount" + "financedAmount" = "totalAmount")
  );

CREATE INDEX IF NOT EXISTS merchant_order_merchant_idx ON merchant_order ("merchantId", "createdAt");

CREATE INDEX IF NOT EXISTS merchant_order_customer_idx ON merchant_order ("customerUserId");

CREATE INDEX IF NOT EXISTS merchant_order_settlement_idx ON merchant_order ("settlementId");

CREATE UNIQUE INDEX IF NOT EXISTS merchant_order_mp_payment_unique ON merchant_order ("mpPaymentId") WHERE "mpPaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS merchant_order_mp_ref_idx ON merchant_order ("mpExternalRef") WHERE "mpExternalRef" IS NOT NULL;

CREATE TABLE IF NOT EXISTS merchant_payout_account (
    "merchantId" text PRIMARY KEY REFERENCES merchant(id) ON DELETE CASCADE,
    cbu text NOT NULL,
    alias text,
    holder text NOT NULL,
    "holderCuit" text NOT NULL,
    "bankName" text,
    "verifiedAt" timestamptz,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  );
COMMIT;
