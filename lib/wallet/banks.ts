/**
 * Entidades por código BCRA (los 3 primeros dígitos de un CBU). Sirve para completar el nombre del banco cuando la
 * validación externa no está disponible. Los CVU de billeteras (000…) no tienen banco: se pide el nombre.
 */
export const BANK_NAMES: Record<string, string> = {
  '007': 'Banco Galicia',
  '011': 'Banco de la Nación Argentina',
  '014': 'Banco de la Provincia de Buenos Aires',
  '015': 'ICBC',
  '016': 'Citibank',
  '017': 'BBVA',
  '020': 'Banco de la Provincia de Córdoba',
  '027': 'Banco Supervielle',
  '029': 'Banco de la Ciudad de Buenos Aires',
  '034': 'Banco Patagonia',
  '044': 'Banco Hipotecario',
  '045': 'Banco de San Juan',
  '060': 'Banco del Tucumán',
  '065': 'Banco Municipal de Rosario',
  '072': 'Banco Santander',
  '083': 'Banco del Chubut',
  '086': 'Banco de Santa Cruz',
  '093': 'Banco de La Pampa',
  '094': 'Banco de Corrientes',
  '097': 'Banco Provincia del Neuquén',
  '143': 'Brubank',
  '147': 'Banco Interfinanzas',
  '150': 'HSBC',
  '158': 'Open Bank',
  '191': 'Banco Credicoop',
  '259': 'Banco Itaú',
  '268': 'Banco Provincia de Tierra del Fuego',
  '269': 'Banco de la República Oriental del Uruguay',
  '285': 'Banco Macro',
  '299': 'Banco Comafi',
  '300': 'Banco de Inversión y Comercio Exterior',
  '301': 'Banco Piano',
  '309': 'Banco Rioja',
  '311': 'Banco del Sol',
  '312': 'Banco Meridian',
  '315': 'Banco BICA',
  '321': 'Banco de Santiago del Estero',
  '322': 'Banco Industrial',
  '330': 'Banco de Santa Fe',
  '386': 'Nuevo Banco de Entre Ríos',
  '389': 'Banco Columbia',
  '430': 'Banco Masventas',
  '431': 'Banco Coinag',
  '432': 'Banco de Comercio',
  '448': 'Banco Dino',
}

/** Nombre del banco a partir de un CBU de 22 dígitos, o `null` si el código no se conoce / es un CVU. */
export function bankNameFromCbu(cbu: string | null | undefined): string | null {
  const d = String(cbu ?? '').replace(/\D/g, '')
  if (d.length !== 22) return null
  return BANK_NAMES[d.slice(0, 3)] ?? null
}
