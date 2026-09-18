"use client";

import type { LoanStatus, KycStatus, PaymentStatus, DisbursementStatus, MerchantStatus, CollectionBucket, ApprovalDecision } from "@/lib/domain/types";
import {
  APPROVAL_LABEL,
  BUCKET_LABEL,
  DISBURSEMENT_STATUS_LABEL,
  KYC_STATUS_LABEL,
  LOAN_STATUS_LABEL,
  MERCHANT_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { ComponentProps } from "react";

const loanTone: Record<LoanStatus, ComponentProps<typeof Badge>["tone"]> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  active: "active",
  paid: "paid",
  cancelled: "cancelled",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Badge tone={loanTone[status]}>{LOAN_STATUS_LABEL[status]}</Badge>;
}

export function KycBadge({ status }: { status: KycStatus }) {
  const tone = {
    pending: "pending",
    in_review: "warn",
    verified: "active",
    rejected: "rejected",
    expired: "cancelled",
  } as const;
  return <Badge tone={tone[status]}>{KYC_STATUS_LABEL[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = {
    pending: "pending",
    matched: "info",
    reconciled: "active",
    rejected: "rejected",
    refunded: "cancelled",
  } as const;
  return <Badge tone={tone[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

export function DisbursementBadge({ status }: { status: DisbursementStatus }) {
  const tone = {
    queued: "pending",
    processing: "info",
    completed: "active",
    failed: "rejected",
  } as const;
  return <Badge tone={tone[status]}>{DISBURSEMENT_STATUS_LABEL[status]}</Badge>;
}

export function MerchantBadge({ status }: { status: MerchantStatus }) {
  const tone = {
    active: "active",
    paused: "pending",
    onboarding: "info",
    rejected: "rejected",
  } as const;
  return <Badge tone={tone[status]}>{MERCHANT_STATUS_LABEL[status]}</Badge>;
}

export function BucketBadge({ bucket }: { bucket: CollectionBucket }) {
  const tone = {
    al_dia: "active",
    "1_30": "pending",
    "31_60": "warn",
    "61_90": "rejected",
    "90_plus": "rejected",
  } as const;
  return <Badge tone={tone[bucket]}>{BUCKET_LABEL[bucket]}</Badge>;
}

export function ApprovalBadge({ decision }: { decision: ApprovalDecision }) {
  const tone = {
    pending: "pending",
    approved: "active",
    observed: "warn",
    rejected: "rejected",
  } as const;
  return <Badge tone={tone[decision]}>{APPROVAL_LABEL[decision]}</Badge>;
}
