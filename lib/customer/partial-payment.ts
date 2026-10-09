import { frenchInstallmentSplit } from '@/lib/legal/money-words'

export type InstallmentLike = {
  id: string
  loanId: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
  paidAt?: Date | string | null
}

export type LoanLike = {
  id: string
  principal: string | number
  term: number
  monthlyRate: string | number
  tna?: string | number
  installmentAmount?: string | number
  totalAmount?: string | number
  status: string
  purpose?: string | null
  createdAt?: Date | string
}

export type InstallmentAllocation = {
  id: string
  number: number
  dueDate: Date
  isOverdue: boolean
  originalAmount: number
  contractualInterest: number
  contractualCapital: number
  allocatedInterest: number
  allocatedCapital: number
  allocatedTotal: number
  remainingAmount: number
  remainingInterest: number
  remainingCapital: number
  statusAfterPayment: 'paid' | 'partial' | 'unpaid'
}

export type PartialPaymentResult = {
  paymentAmount: number
  // Vencidos
  overdueCount: number
  totalOverdueInterest: number
  totalOverdueCapital: number
  totalOverdueAmount: number
  // Cobertura de Intereses
  coversInterest: boolean
  allocatedToInterest: number
  remainingInterestDue: number
  interestCoveragePct: number
  // Cobertura de Capital Vencido
  coversOverdueCapital: boolean
  isOverdueCapitalPartial: boolean
  allocatedToOverdueCapital: number
  remainingOverdueCapital: number
  overdueCapitalCoveragePct: number
  // Excedente / Adelanto de Capital Futuro
  allocatedToCapitalAdvance: number
  futureInterestSavedEstimate: number
  // Amortización e impacto en saldo
  totalCapitalAmortized: number
  initialCapitalBalance: number
  newCapitalBalance: number
  capitalReductionAmount: number
  capitalReductionPct: number
  initialTotalDebt: number
  newTotalDebt: number
  totalDebtReductionAmount: number
  // Diagnóstico
  verdict: 'insufficient_interest' | 'partial_capital' | 'full_overdue' | 'advance_capital' | 'fully_settled'
  verdictTone: 'danger' | 'warning' | 'success'
  verdictTitle: string
  verdictDescription: string
  // Detalle cuota a cuota
  schedule: InstallmentAllocation[]
}

const round = (val: number) => Math.round(val * 100) / 100
const num = (v: unknown) => Number(v) || 0

export function calculatePartialPayment(
  loan: LoanLike,
  installments: InstallmentLike[],
  paymentAmountInput: number,
  referenceDate = new Date(),
): PartialPaymentResult {
  const principal = num(loan.principal)
  const term = Math.max(1, Math.round(num(loan.term)))
  const monthlyRatePct = num(loan.monthlyRate)
  const paymentAmount = Math.max(0, round(paymentAmountInput))

  // Filtrar cuotas del crédito y ordenar por número
  const loanInstallments = installments
    .filter((i) => i.loanId === loan.id)
    .sort((a, b) => a.number - b.number)

  // Enriquecer cada cuota con desglose francés teórico
  type EnrichedItem = {
    inst: InstallmentLike
    number: number
    dueDate: Date
    amount: number
    isPaid: boolean
    isOverdue: boolean
    interest: number
    capital: number
    balanceAfter: number
  }

  const enriched: EnrichedItem[] = loanInstallments.map((inst) => {
    const split = frenchInstallmentSplit(principal, monthlyRatePct, term, inst.number)
    const dDate = new Date(inst.dueDate)
    const isPaid = inst.status === 'paid'
    const isOverdue = !isPaid && (inst.status === 'overdue' || dDate.getTime() < referenceDate.getTime())

    return {
      inst,
      number: inst.number,
      dueDate: dDate,
      amount: round(num(inst.amount) || split.installment),
      isPaid,
      isOverdue,
      interest: split.interest,
      capital: split.capital,
      balanceAfter: split.balance,
    }
  })

  // Cuotas impagas ordenadas por vencimiento/número
  const unpaid = enriched.filter((i) => !i.isPaid)
  const overdue = unpaid.filter((i) => i.isOverdue)

  // Saldo de capital inicial: suma de capital puro de todas las cuotas impagas
  const initialCapitalBalance = round(unpaid.reduce((sum, item) => sum + item.capital, 0))
  // Saldo total contractual inicial
  const initialTotalDebt = round(unpaid.reduce((sum, item) => sum + item.amount, 0))

  // Totales de deuda vencida
  // Si no hay cuotas con fecha vencida, consideramos la próxima cuota exigible como base de referencia
  const hasOverdue = overdue.length > 0
  const referenceGroup = hasOverdue ? overdue : (unpaid.length > 0 ? [unpaid[0]] : [])

  const totalOverdueInterest = round(referenceGroup.reduce((s, i) => s + i.interest, 0))
  const totalOverdueCapital = round(referenceGroup.reduce((s, i) => s + i.capital, 0))
  const totalOverdueAmount = round(totalOverdueInterest + totalOverdueCapital)
  const overdueCount = overdue.length

  // Cascada de Imputación legal (intereses primero, luego capital vencido, luego capital a vencer)
  let available = paymentAmount

  // Paso 1: Intereses exigibles
  const allocatedToInterest = round(Math.min(available, totalOverdueInterest))
  available = round(Math.max(0, available - allocatedToInterest))
  const remainingInterestDue = round(Math.max(0, totalOverdueInterest - allocatedToInterest))
  const coversInterest = totalOverdueInterest === 0 || allocatedToInterest >= totalOverdueInterest
  const interestCoveragePct =
    totalOverdueInterest > 0 ? round(Math.min(100, (allocatedToInterest / totalOverdueInterest) * 100)) : 100

  // Paso 2: Capital vencido
  const allocatedToOverdueCapital = round(Math.min(available, totalOverdueCapital))
  available = round(Math.max(0, available - allocatedToOverdueCapital))
  const remainingOverdueCapital = round(Math.max(0, totalOverdueCapital - allocatedToOverdueCapital))
  const coversOverdueCapital = totalOverdueCapital === 0 || allocatedToOverdueCapital >= totalOverdueCapital
  const isOverdueCapitalPartial = allocatedToOverdueCapital > 0 && !coversOverdueCapital
  const overdueCapitalCoveragePct =
    totalOverdueCapital > 0 ? round(Math.min(100, (allocatedToOverdueCapital / totalOverdueCapital) * 100)) : 100

  // Paso 3: Adelanto de capital futuro (amortización extraordinaria)
  // Se aplica al capital de las cuotas futuras aún no vencidas
  const futureCapitalAvailable = round(
    unpaid.filter((u) => !referenceGroup.includes(u)).reduce((s, i) => s + i.capital, 0),
  )
  const allocatedToCapitalAdvance = round(Math.min(available, futureCapitalAvailable))
  available = round(Math.max(0, available - allocatedToCapitalAdvance))

  // Ahorro estimado de intereses futuros gracias a la amortización extraordinaria:
  // Tasa mensual x plazo ponderado remanente
  const monthsRemaining = Math.max(1, unpaid.length - referenceGroup.length)
  const futureInterestSavedEstimate = round(
    allocatedToCapitalAdvance * (monthlyRatePct / 100) * (monthsRemaining / 2),
  )

  // Total de capital amortizado
  const totalCapitalAmortized = round(allocatedToOverdueCapital + allocatedToCapitalAdvance)

  // Impacto exacto en el saldo
  const newCapitalBalance = round(Math.max(0, initialCapitalBalance - totalCapitalAmortized))
  const capitalReductionAmount = totalCapitalAmortized
  const capitalReductionPct =
    initialCapitalBalance > 0 ? round(Math.min(100, (totalCapitalAmortized / initialCapitalBalance) * 100)) : 0

  const totalEffectivePayment = round(allocatedToInterest + totalCapitalAmortized)
  const newTotalDebt = round(Math.max(0, initialTotalDebt - totalEffectivePayment))
  const totalDebtReductionAmount = totalEffectivePayment

  // Diagnóstico y veredicto
  let verdict: PartialPaymentResult['verdict'] = 'insufficient_interest'
  let verdictTone: PartialPaymentResult['verdictTone'] = 'danger'
  let verdictTitle = ''
  let verdictDescription = ''

  if (newCapitalBalance === 0 && initialCapitalBalance > 0) {
    verdict = 'fully_settled'
    verdictTone = 'success'
    verdictTitle = '¡Cancelación total del saldo deudor!'
    verdictDescription =
      'Este importe cancela el 100% de la deuda pendiente de capital e intereses de este crédito. Quedás completamente libre de deuda.'
  } else if (!coversInterest) {
    verdict = 'insufficient_interest'
    verdictTone = 'danger'
    verdictTitle = 'Pago insuficiente: no cubre los intereses vencidos'
    verdictDescription = `El importe ingresado ($${allocatedToInterest.toLocaleString('es-AR')}) no alcanza a cubrir la totalidad de los intereses vencidos exigibles ($${totalOverdueInterest.toLocaleString('es-AR')}). Faltan $${remainingInterestDue.toLocaleString('es-AR')} exclusivamente para saldar intereses. Este pago no reduce el saldo de capital.`
  } else if (!coversOverdueCapital) {
    verdict = 'partial_capital'
    verdictTone = 'warning'
    verdictTitle = 'Cubre intereses y amortiza parcialmente capital vencido'
    verdictDescription = `Cubre el 100% de los intereses vencidos ($${allocatedToInterest.toLocaleString('es-AR')}) y amortiza $${allocatedToOverdueCapital.toLocaleString('es-AR')} de capital vencido (${overdueCapitalCoveragePct}%). Restan $${remainingOverdueCapital.toLocaleString('es-AR')} de capital vencido para regularizar la mora.`
  } else if (allocatedToCapitalAdvance > 0) {
    verdict = 'advance_capital'
    verdictTone = 'success'
    verdictTitle = '¡Excelente! Regulariza mora y adelanta capital futuro'
    verdictDescription = `Cubre el 100% de intereses y capital vencido, regularizando tu situación. Además, aplica un excedente de $${allocatedToCapitalAdvance.toLocaleString('es-AR')} directamente a reducir capital futuro, ahorrándote intereses.`
  } else {
    verdict = 'full_overdue'
    verdictTone = 'success'
    verdictTitle = '¡Excelente! Cubre 100% de intereses y capital vencido'
    verdictDescription = hasOverdue
      ? 'Cubre la totalidad de los intereses y el capital de las cuotas vencidas. Tu crédito queda al día.'
      : 'Cubre íntegramente la cuota exigible, cancelando sus intereses y amortizando su capital.'
  }

  // Desglose cuota por cuota (Schedule Allocation)
  let runAvailable = paymentAmount
  const schedule: InstallmentAllocation[] = unpaid.map((item) => {
    // Para esta cuota, primero cubrimos su interés si queda dinero
    const allocInt = round(Math.min(runAvailable, item.interest))
    runAvailable = round(Math.max(0, runAvailable - allocInt))

    // Luego cubrimos su capital si queda dinero
    const allocCap = round(Math.min(runAvailable, item.capital))
    runAvailable = round(Math.max(0, runAvailable - allocCap))

    const allocTotal = round(allocInt + allocCap)
    const remainingAmt = round(Math.max(0, item.amount - allocTotal))
    const remInt = round(Math.max(0, item.interest - allocInt))
    const remCap = round(Math.max(0, item.capital - allocCap))

    let statusAfter: InstallmentAllocation['statusAfterPayment'] = 'unpaid'
    if (allocTotal >= item.amount) {
      statusAfter = 'paid'
    } else if (allocTotal > 0) {
      statusAfter = 'partial'
    }

    return {
      id: item.inst.id,
      number: item.number,
      dueDate: item.dueDate,
      isOverdue: item.isOverdue,
      originalAmount: item.amount,
      contractualInterest: item.interest,
      contractualCapital: item.capital,
      allocatedInterest: allocInt,
      allocatedCapital: allocCap,
      allocatedTotal: allocTotal,
      remainingAmount: remainingAmt,
      remainingInterest: remInt,
      remainingCapital: remCap,
      statusAfterPayment: statusAfter,
    }
  })

  return {
    paymentAmount,
    overdueCount,
    totalOverdueInterest,
    totalOverdueCapital,
    totalOverdueAmount,
    coversInterest,
    allocatedToInterest,
    remainingInterestDue,
    interestCoveragePct,
    coversOverdueCapital,
    isOverdueCapitalPartial,
    allocatedToOverdueCapital,
    remainingOverdueCapital,
    overdueCapitalCoveragePct,
    allocatedToCapitalAdvance,
    futureInterestSavedEstimate,
    totalCapitalAmortized,
    initialCapitalBalance,
    newCapitalBalance,
    capitalReductionAmount,
    capitalReductionPct,
    initialTotalDebt,
    newTotalDebt,
    totalDebtReductionAmount,
    verdict,
    verdictTone,
    verdictTitle,
    verdictDescription,
    schedule,
  }
}
