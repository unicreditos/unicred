export type DiditMedia = { label: string; url: string; kind: 'image' | 'video' }

export type DiditIdCapture = {
  status: string
  documentType: string | null
  documentNumber: string | null
  personalNumber: string | null
  taxNumber: string | null
  fullName: string | null
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  age: number | null
  gender: string | null
  nationality: string | null
  address: string | null
  formattedAddress: string | null
  dateOfIssue: string | null
  expirationDate: string | null
  issuingState: string | null
  media: DiditMedia[]
}

export type DiditLivenessCapture = {
  status: string
  method: string | null
  score: number | null
  ageEstimation: number | null
  media: DiditMedia[]
}

export type DiditFaceCapture = {
  status: string
  score: number | null
  media: DiditMedia[]
}

export type DiditIpCapture = {
  status: string
  country: string | null
  city: string | null
  isp: string | null
  isVpn: boolean | null
  warnings: string[]
}

export type DiditCapture = {
  sessionId: string | null
  status: string | null
  workflowId: string | null
  ids: DiditIdCapture[]
  liveness: DiditLivenessCapture[]
  faces: DiditFaceCapture[]
  ip: DiditIpCapture[]
  aml: { status: string }[]
  warnings: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
}

function str(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length ? text : null
}

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function media(label: string, url: unknown, kind: DiditMedia['kind'] = 'image'): DiditMedia | null {
  const href = str(url)
  if (!href || !/^https?:\/\//i.test(href)) return null
  return { label, url: href, kind }
}

function warningTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      const rec = asRecord(item)
      return str(rec?.short_description) || str(rec?.long_description) || str(rec?.risk) || str(rec?.feature)
    })
    .filter((item): item is string => Boolean(item))
}

export function extractDiditDecision(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw)
  if (!root) return null
  const nested = asRecord(root.didit)
  const fromOcr = nested ? asRecord(nested.decision) : null
  if (fromOcr) return fromOcr
  if (Array.isArray(root.id_verifications) || Array.isArray(root.face_matches) || root.session_id) return root
  return asRecord(root.decision) ?? root
}

export function parseDiditCapture(raw: unknown, fallback?: { sessionId?: string | null; status?: string | null }): DiditCapture {
  const decision = extractDiditDecision(raw)
  const ids = asArray(decision?.id_verifications).map((item) => {
    const extra = asRecord(item.extra_fields)
    const mediaItems = [
      media('DNI frente', item.front_image ?? item.full_front_image),
      media('DNI dorso', item.back_image ?? item.full_back_image),
      media('Retrato del documento', item.portrait_image),
      media('Frente completo', item.full_front_image),
      media('Dorso completo', item.full_back_image),
    ].filter((item): item is DiditMedia => Boolean(item))
    return {
      status: str(item.status) || '—',
      documentType: str(item.document_type) || str(item.document_subtype),
      documentNumber: str(item.document_number) || str(item.identification_number),
      personalNumber: str(item.personal_number),
      taxNumber: str(extra?.tax_number),
      fullName: str(item.full_name),
      firstName: str(item.first_name),
      lastName: str(item.last_name),
      birthDate: str(item.date_of_birth),
      age: num(item.age),
      gender: str(item.gender),
      nationality: str(item.nationality),
      address: str(item.address),
      formattedAddress: str(item.formatted_address),
      dateOfIssue: str(item.date_of_issue),
      expirationDate: str(item.expiration_date),
      issuingState: str(item.issuing_state_name) || str(item.issuing_state),
      media: mediaItems,
    } satisfies DiditIdCapture
  })

  const liveness = asArray(decision?.liveness_checks).map((item) => ({
    status: str(item.status) || '—',
    method: str(item.method),
    score: num(item.score),
    ageEstimation: num(item.age_estimation),
    media: [
      media('Selfie / liveness', item.reference_image),
      media('Video de liveness', item.video_url, 'video'),
    ].filter((item): item is DiditMedia => Boolean(item)),
  }))

  const faces = asArray(decision?.face_matches).map((item) => ({
    status: str(item.status) || '—',
    score: num(item.score),
    media: [
      media('Imagen origen', item.source_image),
      media('Imagen destino', item.target_image),
    ].filter((item): item is DiditMedia => Boolean(item)),
  }))

  const ip = asArray(decision?.ip_analyses).map((item) => ({
    status: str(item.status) || '—',
    country: str(item.ip_country) || str(item.ip_country_code),
    city: str(item.ip_city),
    isp: str(item.isp) || str(item.organization),
    isVpn: typeof item.is_vpn_or_tor === 'boolean' ? item.is_vpn_or_tor : null,
    warnings: warningTexts(item.warnings),
  }))

  const aml = asArray(decision?.aml_screenings).map((item) => ({ status: str(item.status) || '—' }))
  const warnings = [
    ...ids.flatMap(() => [] as string[]),
    ...warningTexts(decision?.warnings),
    ...ip.flatMap((item) => item.warnings),
  ]

  return {
    sessionId: str(decision?.session_id) || fallback?.sessionId || null,
    status: str(decision?.status) || fallback?.status || null,
    workflowId: str(decision?.workflow_id) || null,
    ids,
    liveness,
    faces,
    ip,
    aml,
    warnings: Array.from(new Set(warnings)),
  }
}

export function groupDni(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '— — — —'
  return digits.replace(/(\d{1,4})(?=(\d{4})*$)/g, '$1 ').trim()
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'UC'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
