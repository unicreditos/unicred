export type InstallmentDoc = {
  id?: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
  paidAt?: Date | string | null
}

export type ContractAccount = {
  accountType?: string | null
  bankName?: string | null
  holderName?: string | null
  holderCuil?: string | null
  cbu?: string | null
  cvu?: string | null
  alias?: string | null
}

export type ContractDocData = {
  id: string
  loanId: string
  version: string
  templateName: string
  createdAt: Date | string
  effectiveDate?: Date | string | null
  expirationDate?: Date | string | null
  acceptedAt?: Date | string | null
  status: string
  signerName?: string | null
  signerCuil?: string | null
  signatureType?: string | null
  acceptedIp?: string | null
  loan: {
    id: string
    principal: string | number
    term: number
    monthlyRate: string | number
    tna?: string | number | null
    tea?: string | number | null
    installmentAmount: string | number
    totalAmount: string | number
    cft?: string | number | null
    purpose?: string | null
    createdAt: Date | string
    type?: string
  }
  customer: {
    name?: string | null
    cuil?: string | null
    dni?: string | null
    email?: string | null
    phone?: string | null
    city?: string | null
    province?: string | null
    address?: string | null
    employmentStatus?: string | null
    monthlyIncome?: string | number | null
  } | null
  installments: InstallmentDoc[]
  bankAccount?: ContractAccount | null
  disbursementAccount?: ContractAccount | null
  pagareNumber?: string | null
  refinanceCount?: number
  lastRefinanceAt?: string | null
  lastIntimation?: {
    number: string
    at: string
    amount: number
    installments: Array<{ number: number; dueDate: string; amount: number; daysLate: number }>
  } | null
}
