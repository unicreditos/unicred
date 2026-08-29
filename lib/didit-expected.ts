/** Datos personales que sí se pueden mandar a Didit. Didit verifica una persona, no una SAS. */

const COMPANY_NAME =
  /\b(?:s\.?\s*r\.?\s*l\.?|s\.?\s*a\.?\s*s\.?|s\.?\s*a\.?|s\.?\s*h\.?|s\.?\s*c\.?\s*s\.?|sociedad(?:es)?(?:\s+an[oó]nima|\s+de\s+responsabilidad)?|cooperativa|funds*s\.?\s*a\.?|ltda\.?)\b/i

const PERSON_CUIT_PREFIX = new Set(['20', '23', '24', '27'])

export type DiditPersonExpected = {
  first_name?: string
  last_name?: string
  date_of_birth?: string
  nationality?: string
  identification_number?: string
  id_country?: string
}

export function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] }
  return {
    last_name: parts[0],
    first_name: parts.slice(1).join(' '),
  }
}

export function isCompanyStyleName(name: string) {
  return COMPANY_NAME.test(name.trim())
}

/** Razón social o denominación de sociedad: no se manda a Didit. */
export function isSocietyLabelForDidit(name: string, businessName?: string) {
  const n = name.trim()
  if (!n) return false
  if (isCompanyStyleName(n)) return true
  const biz = (businessName || '').trim()
  return Boolean(biz) && n.localeCompare(biz, 'es', { sensitivity: 'accent' }) === 0
}

function localIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function adultBirthDateBounds(now = new Date()) {
  const max = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  const min = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate())
  return { min: localIsoDate(min), max: localIsoDate(max) }
}

export function isPlausibleAdultBirthDate(iso: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false
  const { min, max } = adultBirthDateBounds(now)
  return iso >= min && iso <= max
}

export function plausiblePersonDni(raw?: string) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 7 || digits.length === 8) return digits
  if (digits.length === 11 && PERSON_CUIT_PREFIX.has(digits.slice(0, 2))) {
    return digits.slice(2, 10).replace(/^0+/, '') || digits.slice(2, 10)
  }
  return undefined
}

export function diditPersonExpectedDetails(input: {
  fullName?: string
  dni?: string
  birthDate?: string
}): DiditPersonExpected | undefined {
  const name = (input.fullName || '').trim()
  const personName = name && !isCompanyStyleName(name) ? splitPersonName(name) : null
  const hasDistinctNames =
    Boolean(personName?.first_name && personName.last_name) && personName!.first_name !== personName!.last_name

  const details: DiditPersonExpected = {}
  if (hasDistinctNames) {
    details.first_name = personName!.first_name
    details.last_name = personName!.last_name
  }

  const dni = plausiblePersonDni(input.dni)
  if (dni) details.identification_number = dni

  const dob = input.birthDate?.trim()
  if (dob && isPlausibleAdultBirthDate(dob)) details.date_of_birth = dob

  if (!details.first_name && !details.identification_number && !details.date_of_birth) {
    return undefined
  }

  details.nationality = 'ARG'
  details.id_country = 'ARG'
  return details
}
