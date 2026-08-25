export const WITHDRAWAL_DAYS = 10

export function withdrawalDeadline(acceptedAt: Date | string) {
  const deadline = new Date(acceptedAt)
  deadline.setDate(deadline.getDate() + WITHDRAWAL_DAYS)
  return deadline
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
