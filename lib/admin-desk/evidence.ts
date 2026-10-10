import { extractDiditDecision, parseDiditCapture } from '@/lib/didit-capture'
import { DEFAULT_RISK_RULES, type RiskRuleParams } from '@/lib/loan-underwriting'

export function digitsOnly(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

/** null = no hay lectura para comparar. */
export function ocrDniMatch(profileDni: string | null | undefined, ocrDni: string | null | undefined): boolean | null {
  const profile = digitsOnly(profileDni)
  const ocr = digitsOnly(ocrDni)
  if (profile.length < 7 || ocr.length < 7) return null
  return profile === ocr || profile.endsWith(ocr) || ocr.endsWith(profile)
}

function passed(status: string | null | undefined) {
  return /approv|pass|success|clear/i.test(status || '')
}

function failed(status: string | null | undefined) {
  return /reject|fail|declin/i.test(status || '')
}

export type KycEvidenceInput = {
  dniFrontImageUrl?: string | null
  dniBackImageUrl?: string | null
  selfieImageUrl?: string | null
  videoUrl?: string | null
  dniNumber?: string | null
  cuilVerified?: boolean | null
  faceMatchScore?: string | number | null
  ocrData?: unknown
  profileDni?: string | null
}

export type KycEvidence = {
  front: string | null
  back: string | null
  selfie: string | null
  video: string | null
  faceMatchScore: number | null
  ocrDni: string | null
  ocrName: string | null
  ocrBirthDate: string | null
  ocrGender: string | null
  ocrAddress: string | null
  liveness: boolean | null
  documentMatch: boolean | null
}

function blankEvidence(): KycEvidence {
  return {
    front: null,
    back: null,
    selfie: null,
    video: null,
    faceMatchScore: null,
    ocrDni: null,
    ocrName: null,
    ocrBirthDate: null,
    ocrGender: null,
    ocrAddress: null,
    liveness: null,
    documentMatch: null,
  }
}

/** Capturas y lectura reales de Didit. Sin fotos de muestra. */
export function readKycEvidence(row: KycEvidenceInput | null | undefined): KycEvidence {
  if (!row) return blankEvidence()
  const decision = extractDiditDecision(row.ocrData)
  let capture: ReturnType<typeof parseDiditCapture> | null = null
  if (decision) {
    try {
      capture = parseDiditCapture(decision)
    } catch {
      capture = null
    }
  }
  const id = capture?.ids[0]
  const live = capture?.liveness[0]
  const rawFace = row.faceMatchScore
  const face = rawFace == null || rawFace === '' ? Number.NaN : Number(rawFace)
  const ocrDni = digitsOnly(id?.documentNumber || id?.personalNumber || row.dniNumber) || null
  const ocrName = (id?.fullName || [id?.firstName, id?.lastName].filter(Boolean).join(' ')).trim() || null
  const match = ocrDniMatch(row.profileDni, ocrDni)
  return {
    front: row.dniFrontImageUrl || null,
    back: row.dniBackImageUrl || null,
    selfie: row.selfieImageUrl || null,
    video: row.videoUrl || null,
    faceMatchScore: Number.isFinite(face) ? face : null,
    ocrDni,
    ocrName,
    ocrBirthDate: id?.birthDate || null,
    ocrGender: id?.gender || null,
    ocrAddress: id?.formattedAddress || id?.address || null,
    liveness: live ? (passed(live.status) ? true : failed(live.status) ? false : null) : null,
    documentMatch: match != null ? match : row.cuilVerified ? true : null,
  }
}

export function applicationPolicyFlags(input: {
  kycVerified: boolean
  score: number | null
  amount: number
  income: number
  installment: number
  bcraSituation: number | null
  isFirstCredit: boolean
  rules?: RiskRuleParams
}): string[] {
  const rules = input.rules ?? DEFAULT_RISK_RULES
  const flags: string[] = []
  if (!input.kycVerified) flags.push('kyc_incomplete')
  if (input.score == null) flags.push('score_missing')
  else if (input.score < rules.scoreRejectBelow) flags.push('score_reject_zone')
  else if (input.score < rules.scoreAutoQualifyAt) flags.push('low_score')
  if (!(input.income > 0)) flags.push('income_missing')
  else if (input.installment > input.income * rules.incomeDtiRatio) flags.push('dti_high')
  if (input.isFirstCredit && input.amount > rules.firstCreditHardCap) flags.push('high_ticket')
  if (input.bcraSituation != null && input.bcraSituation >= rules.bcraWorstSituationRejectAt) flags.push('bcra_irregular')
  return flags
}
