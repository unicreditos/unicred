/**
 * Catálogo operativo de pagos de servicios y recargas UNICRÉDITOS.
 * El cliente paga con saldo de billetera; tesorería RM liquida al prestador.
 */

export type ServiceCategoryId =
  | 'recargas'
  | 'luz'
  | 'gas'
  | 'agua'
  | 'internet'
  | 'telefono'
  | 'tv'
  | 'impuestos'
  | 'seguros'
  | 'transporte'
  | 'educacion'
  | 'otros'

export type ServiceProvider = {
  id: string
  category: ServiceCategoryId
  name: string
  kind: 'recharge' | 'bill'
  minAmount: number
  maxAmount: number
  /** Montos sugeridos (recargas). */
  presets?: number[]
  accountHint: string
  accountPattern?: RegExp
}

export const SERVICE_CATEGORIES: {
  id: ServiceCategoryId
  label: string
  blurb: string
}[] = [
  { id: 'recargas', label: 'Recargas de celular', blurb: 'Claro, Movistar, Personal, Tuenti y más.' },
  { id: 'luz', label: 'Electricidad', blurb: 'EDESUR, EDENOR, EPEC y cooperativas.' },
  { id: 'gas', label: 'Gas', blurb: 'Metrogas, Naturgy, Camuzzi y otras.' },
  { id: 'agua', label: 'Agua', blurb: 'AySA, ABSA y prestadores provinciales.' },
  { id: 'internet', label: 'Internet y cable', blurb: 'Fibertel, Telecentro, Claro Hogar, DirecTV.' },
  { id: 'telefono', label: 'Telefonía fija', blurb: 'Facturas de línea fija y packs.' },
  { id: 'tv', label: 'TV y streaming', blurb: 'Cable, satélite y plataformas.' },
  { id: 'impuestos', label: 'Impuestos y tasas', blurb: 'ARBA, AGIP, municipales y patentes.' },
  { id: 'seguros', label: 'Seguros', blurb: 'Cuotas de pólizas y mutuales.' },
  { id: 'transporte', label: 'Transporte', blurb: 'SUBE, peajes y abonos.' },
  { id: 'educacion', label: 'Educación', blurb: 'Colegios, universidades e institutos.' },
  { id: 'otros', label: 'Otros servicios', blurb: 'Otros prestadores habilitados vía red UNICRÉDITOS.' },
]

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  {
    id: 'claro_recarga',
    category: 'recargas',
    name: 'Claro · Recarga',
    kind: 'recharge',
    minAmount: 100,
    maxAmount: 50_000,
    presets: [500, 1000, 2000, 5000, 10_000],
    accountHint: 'Número de celular (10 dígitos)',
    accountPattern: /^\d{10}$/,
  },
  {
    id: 'movistar_recarga',
    category: 'recargas',
    name: 'Movistar · Recarga',
    kind: 'recharge',
    minAmount: 100,
    maxAmount: 50_000,
    presets: [500, 1000, 2000, 5000, 10_000],
    accountHint: 'Número de celular (10 dígitos)',
    accountPattern: /^\d{10}$/,
  },
  {
    id: 'personal_recarga',
    category: 'recargas',
    name: 'Personal · Recarga',
    kind: 'recharge',
    minAmount: 100,
    maxAmount: 50_000,
    presets: [500, 1000, 2000, 5000, 10_000],
    accountHint: 'Número de celular (10 dígitos)',
    accountPattern: /^\d{10}$/,
  },
  {
    id: 'tuenti_recarga',
    category: 'recargas',
    name: 'Tuenti · Recarga',
    kind: 'recharge',
    minAmount: 100,
    maxAmount: 30_000,
    presets: [300, 500, 1000, 2000],
    accountHint: 'Número de celular (10 dígitos)',
    accountPattern: /^\d{10}$/,
  },
  {
    id: 'edenor',
    category: 'luz',
    name: 'EDENOR',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 2_000_000,
    accountHint: 'N° de cliente / NIS',
  },
  {
    id: 'edesur',
    category: 'luz',
    name: 'EDESUR',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 2_000_000,
    accountHint: 'N° de cliente / NIS',
  },
  {
    id: 'metrogas',
    category: 'gas',
    name: 'Metrogas',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 1_000_000,
    accountHint: 'N° de cliente',
  },
  {
    id: 'naturgy',
    category: 'gas',
    name: 'Naturgy',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 1_000_000,
    accountHint: 'N° de cliente',
  },
  {
    id: 'aysa',
    category: 'agua',
    name: 'AySA',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 500_000,
    accountHint: 'N° de cliente / partida',
  },
  {
    id: 'telecom_internet',
    category: 'internet',
    name: 'Personal Fibra / Flow',
    kind: 'bill',
    minAmount: 500,
    maxAmount: 500_000,
    accountHint: 'N° de cuenta o DNI titular',
  },
  {
    id: 'telecentro',
    category: 'internet',
    name: 'Telecentro',
    kind: 'bill',
    minAmount: 500,
    maxAmount: 500_000,
    accountHint: 'N° de cliente',
  },
  {
    id: 'arba',
    category: 'impuestos',
    name: 'ARBA',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 5_000_000,
    accountHint: 'CUIT / partida / VEP',
  },
  {
    id: 'agip',
    category: 'impuestos',
    name: 'AGIP CABA',
    kind: 'bill',
    minAmount: 100,
    maxAmount: 5_000_000,
    accountHint: 'CUIT / número de liquidación',
  },
  {
    id: 'sube',
    category: 'transporte',
    name: 'SUBE · Carga',
    kind: 'recharge',
    minAmount: 100,
    maxAmount: 50_000,
    presets: [500, 1000, 2000, 5000],
    accountHint: 'N° de tarjeta SUBE (16 dígitos)',
    accountPattern: /^\d{16}$/,
  },
  {
    id: 'otro_servicio',
    category: 'otros',
    name: 'Otro servicio (red UNICRÉDITOS)',
    kind: 'bill',
    minAmount: 50,
    maxAmount: 5_000_000,
    accountHint: 'Identificador / código de barras / referencia',
  },
]

export function serviceProviderById(id: string) {
  return SERVICE_PROVIDERS.find((p) => p.id === id) ?? null
}

export function providersByCategory(category: ServiceCategoryId) {
  return SERVICE_PROVIDERS.filter((p) => p.category === category)
}
