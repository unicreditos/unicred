import { frenchInstallmentSplit } from '@/lib/legal/money-words'

export type EarlySettlement = {
  paidCount: number
  unpaidCount: number
  remainingCapital: number
  contractualRemaining: number
  interestDeduction: number
  settlementAmount: number
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

/** Cancelación anticipada: se cobra el capital remanente; se deducen intereses no devengados. */
export function computeEarlySettlement(input: {
  principal: number
  monthlyRate: number
  term: number
  paidCount: number
  unpaidAmounts: number[]
}): EarlySettlement {
  const paidCount = Math.max(0, input.paidCount)
  const remainingCapital =
    paidCount <= 0
      ? money(input.principal)
      : frenchInstallmentSplit(input.principal, input.monthlyRate, input.term, paidCount).balance
  const contractualRemaining = money(input.unpaidAmounts.reduce((sum, n) => sum + n, 0))
  const interestDeduction = money(Math.max(0, contractualRemaining - remainingCapital))
  return {
    paidCount,
    unpaidCount: input.unpaidAmounts.length,
    remainingCapital,
    contractualRemaining,
    interestDeduction,
    settlementAmount: remainingCapital,
  }
}
