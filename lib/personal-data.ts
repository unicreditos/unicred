import { dniFromPersonCuit, digitsOnly } from '@/lib/arca/tax-condition'
import { isValidCuit } from '@/lib/cuit'
import { isPlausibleAdultBirthDate } from '@/lib/didit-expected'

/** Validación de datos personales de la billetera y del KYC (portada de unicred-verify: la base es compartida). */

export function normalizeDni(value: string | null | undefined): string {
  return digitsOnly(value).replace(/^0+/, '')
}

export function isValidDni(value: string | null | undefined): boolean {
  return /^\d{7,8}$/.test(normalizeDni(value))
}

/** El DNI embebido en el CUIL/CUIT de una persona física (dígitos 3 a 10). */
export function cuilMatchesDni(cuil: string | null | undefined, dni: string | null | undefined): boolean {
  const fromCuil = dniFromPersonCuit(digitsOnly(cuil))
  if (!fromCuil) return false
  return normalizeDni(fromCuil) === normalizeDni(dni)
}

export function formatCuil(value: string | null | undefined): string {
  const d = digitsOnly(value)
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : (value ?? '')
}

export function formatDni(value: string | null | undefined): string {
  const d = normalizeDni(value)
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}


export type PersonalDataInput = {
  cuil: string
  dni: string
  birthDate: string
  phone: string
}

export type PersonalDataResult =
  | { ok: true; value: PersonalDataInput }
  | { ok: false; errors: Partial<Record<keyof PersonalDataInput, string>> }

/** Validación de la ficha personal. Se usa en el servidor; el cliente solo la repite para avisar antes. */
export function validatePersonalData(raw: Partial<Record<keyof PersonalDataInput, string | null | undefined>>): PersonalDataResult {
  const errors: Partial<Record<keyof PersonalDataInput, string>> = {}
  const cuil = digitsOnly(raw.cuil)
  const dni = normalizeDni(raw.dni)
  const birthDate = String(raw.birthDate ?? '').trim()
  const phone = digitsOnly(raw.phone)

  if (!isValidCuit(cuil)) errors.cuil = 'El CUIL no es válido. Revisá los 11 dígitos.'
  else if (!dniFromPersonCuit(cuil)) errors.cuil = 'Ingresá un CUIL de persona (empieza con 20, 23, 24 o 27).'

  if (!isValidDni(dni)) errors.dni = 'El DNI debe tener 7 u 8 dígitos.'
  else if (!errors.cuil && !cuilMatchesDni(cuil, dni)) errors.cuil = 'El CUIL no corresponde a ese DNI.'

  if (!isPlausibleAdultBirthDate(birthDate)) errors.birthDate = 'Tenés que ser mayor de 18 años.'

  if (phone.length < 8 || phone.length > 15) errors.phone = 'Ingresá un teléfono válido, con código de área.'

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { cuil, dni, birthDate, phone } }
}
