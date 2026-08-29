/**
 * Identidad institucional de UNICRÉDITOS.
 * Razón social, CUIT y domicilio salen de la constancia AFIP / IGJ
 * de RM International Group S.A.S. El CUIT de marca no se toma del
 * certificado WSAA (puede ser de otro titular).
 *
 * UNICRÉDITOS es la unidad de créditos de Grupo Emprenor, operada por
 * esa SAS. No se publica el CUIT de otras personas ni el domicilio de
 * obra del NOA en el mutuo.
 */

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function formatCuit(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return raw || null
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

const COMPANY_CUIT = '30-71603601-0'
const COMPANY_ADDRESS =
  'Maipú 566, piso 4° “D”, C.P. 1006, Ciudad Autónoma de Buenos Aires'

const resolvedCuit = formatCuit(readEnv('NEXT_PUBLIC_BRAND_CUIT', 'BRAND_CUIT')) || COMPANY_CUIT
const resolvedAddress = readEnv('NEXT_PUBLIC_BRAND_ADDRESS', 'BRAND_ADDRESS') || COMPANY_ADDRESS

export const GROUP = {
  name: 'Grupo Emprenor',
  productLine: 'Un producto Grupo Emprenor',
  home: 'https://www.emprenor.com.ar/',
  units: [
    {
      id: 'emprenor',
      name: 'EMPRENOR',
      role: 'Construcción e instalaciones',
      href: 'https://www.emprenor.com.ar/',
    },
    {
      id: 'fixya',
      name: 'FixYa',
      role: 'Marketplace de oficios',
      href: 'https://fixya.emprenor.com/',
    },
    {
      id: 'emitia',
      name: 'EMITIA',
      role: 'Facturación electrónica',
      href: 'https://www.emitia.com.ar/',
    },
    {
      id: 'myemprenor',
      name: 'MyEmprenor',
      role: 'Gestión de obras',
      href: 'https://www.myemprenor.online/',
    },
    {
      id: 'unipagos',
      name: 'UniPagos',
      role: 'Pagos',
      href: 'https://unipagos.com/',
    },
    {
      id: 'unicreditos',
      name: 'UNICRÉDITOS',
      role: 'Créditos',
      href: 'https://www.unicreditos.com/',
      current: true,
    },
  ],
} as const

export type GroupUnit = (typeof GROUP.units)[number]

export const BRAND = {
  company: 'UNICRÉDITOS',
  legalName: 'RM International Group S.A.S.',
  legalForm: 'Sociedad por Acciones Simplificada',
  slogan: 'Créditos, cuotas, billetera y servicios en una sola cuenta',
  tagline: 'Impulsamos tus proyectos, construimos tu futuro.',
  valueProp: 'Tu manera de comprar en cuotas y pedir préstamos digitales.',
  cuit: resolvedCuit,
  address: resolvedAddress,
  city: 'Ciudad Autónoma de Buenos Aires',
  igj: 'RL-2018-24089239-APN-DSC#IGJ',
  incorporated: '21 de mayo de 2018',
  iibb: '901-30716036010',
  iibbRegime: 'Convenio Multilateral',
  iva: 'IVA Responsable Inscripto',
  domain: 'unicreditos.com',
  /** Preferí siempre el dominio canónico en documentos; no filtrar localhost aquí — usar publicBrandWebsite(). */
  website: readEnv('NEXT_PUBLIC_SITE_URL') || 'https://unicreditos.com',
  domains: ['unicreditos.com', 'unicreditos.com.ar', 'unicreditos.store', 'unicreditos.online'] as const,
  supportEmail: readEnv('NEXT_PUBLIC_SUPPORT_EMAIL') || 'soporte@unicreditos.com',
  helpEmail: readEnv('NEXT_PUBLIC_HELP_EMAIL') || 'soporte@unicreditos.com',
  merchantsEmail: readEnv('NEXT_PUBLIC_MERCHANTS_EMAIL') || 'comercios@unicreditos.com',
  privacyEmail: readEnv('NEXT_PUBLIC_PRIVACY_EMAIL') || 'privacidad@unicreditos.com',
  complianceEmail: readEnv('NEXT_PUBLIC_COMPLIANCE_EMAIL') || 'cumplimiento@unicreditos.com',
  phone: readEnv('NEXT_PUBLIC_BRAND_PHONE', 'BRAND_PHONE') || '',
  logoUrl: '/logo.svg',
  treasuryCbu: readEnv('TREASURY_CBU') || '1430001725039815100019',
} as const

export function legalCuitLabel() {
  return BRAND.cuit
}

/** URL pública para membretes/impresos. Nunca expone localhost. En producción Vercel sirve www. */
export function publicBrandWebsite() {
  const fallback = 'https://www.unicreditos.com'
  const raw = String(BRAND.website || '').trim()
  if (!raw) return fallback
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.local')) {
      return fallback
    }
    if (u.hostname === 'unicreditos.com') u.hostname = 'www.unicreditos.com'
    return `${u.protocol}//${u.host}`
  } catch {
    return fallback
  }
}

export function legalPartyLine() {
  return `${BRAND.legalName} (${BRAND.legalForm}, CUIT ${legalCuitLabel()}), domicilio ${BRAND.address}`
}

/** Pie público: unidad de grupo + operador del mutuo (SAS). */
export function groupOperatorLine() {
  return `${BRAND.company} es la unidad de créditos de ${GROUP.name}, operada por ${BRAND.legalName} (CUIT ${legalCuitLabel()}).`
}

export function groupSiblingUnits() {
  return GROUP.units.filter((unit) => !('current' in unit && unit.current))
}

/** Bloque de marca que se guarda en cada comprobante emitido. */
export function receiptBranding() {
  return {
    company: BRAND.company,
    brand: BRAND.company,
    legalName: BRAND.legalName,
    legalForm: BRAND.legalForm,
    slogan: BRAND.slogan,
    cuit: BRAND.cuit,
    address: BRAND.address,
    igj: BRAND.igj,
    iibb: BRAND.iibb,
    iva: BRAND.iva,
    website: BRAND.domain,
    supportEmail: BRAND.supportEmail,
    logoUrl: BRAND.logoUrl,
    qrEnabled: true,
  }
}
