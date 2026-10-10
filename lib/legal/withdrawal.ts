import { addDaysAR } from '@/lib/date-ar'

export const WITHDRAWAL_DAYS = 10

export function withdrawalDeadline(acceptedAt: Date | string) {
  return addDaysAR(acceptedAt, WITHDRAWAL_DAYS)
}

export function canWithdrawAcceptance(opts: {
  contractStatus?: string | null
  acceptedAt?: Date | string | null
  loanStatus?: string | null
  disbursedAt?: Date | string | null
  now?: Date
}) {
  if (opts.contractStatus !== 'accepted' || !opts.acceptedAt) return false
  if (
    opts.disbursedAt ||
    opts.loanStatus === 'active' ||
    opts.loanStatus === 'paid' ||
    opts.loanStatus === 'cancelled' ||
    opts.loanStatus === 'rejected'
  ) {
    return false
  }
  return (opts.now ?? new Date()) <= withdrawalDeadline(opts.acceptedAt)
}
