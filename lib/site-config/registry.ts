import { z } from 'zod'
import { BRAND } from '@/lib/brand'
import { LOAN_CATALOG } from '@/lib/loan-catalog'
import { LEGAL_COPY, LEGAL_PRIVACY_VERSION, LEGAL_REVISION, LEGAL_TCG_VERSION } from '@/lib/legal/copy'
import { INCOME_DTI_RATIO } from '@/lib/loan-underwriting'

/**
 * Registro de lo que se puede editar desde el backoffice. Cada clave declara su tipo (zod), su valor por
 * defecto (el que hoy vive en el código y que sigue siendo el respaldo), su sensibilidad y los campos del
 * formulario. Agregar un valor nuevo editable = una entrada acá; después se edita solo desde el panel.
 */

export type Sensitivity = 'normal' | 'pricing' | 'legal'
export type ConfigKind = 'setting' | 'content_block' | 'legal_document'
export type ConfigTab = 'comisiones' | 'textos' | 'legal' | 'parametros'
export type PreviewKind = 'text' | 'legal' | 'pricing' | 'generic'

export type FieldSpec = {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'rows'
  help?: string
  suffix?: string
  step?: number
  placeholder?: string
  maxLength?: number
  options?: Array<{ value: string; label: string }>
  /** type 'rows': campos de cada fila. */
  rows?: FieldSpec[]
  addLabel?: string
  maxRows?: number
}

export type ConfigDefinition = {
  key: string
  kind: ConfigKind
  tab: ConfigTab
  label: string
  description: string
  sensitivity: Sensitivity
  schema: z.ZodType<unknown>
  defaults: unknown
  fields: FieldSpec[]
  preview: PreviewKind
  /** ¿La web o los cálculos ya leen este valor? Si es false solo se guarda (prototipo). */
  wired: boolean
  wiredNote: string
}

const money = z.number().finite().min(0).max(1_000_000_000)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
const text = (min: number, max: number) => z.string().trim().min(min, `Mínimo ${min} caracteres`).max(max, `Máximo ${max} caracteres`)

/* ------------------------------ Comisiones y tasas ------------------------------ */

const productSchema = z
  .object({
    type: z.enum(['personal', 'consumo', 'comercio']),
    name: text(3, 80),
    monthlyRate: z.number().finite().min(0, 'No puede ser negativa').max(25, 'Tasa mensual fuera de rango (máx. 25%)'),
    minAmount: money,
    maxAmount: money,
    minTerm: z.number().int().min(1).max(120),
    maxTerm: z.number().int().min(1).max(120),
    referenceAmount: money,
    referenceTerm: z.number().int().min(1).max(120),
  })
  .superRefine((p, ctx) => {
    if (p.minAmount > p.maxAmount) ctx.addIssue({ code: 'custom', path: ['maxAmount'], message: 'El monto máximo debe ser mayor o igual al mínimo' })
    if (p.minTerm > p.maxTerm) ctx.addIssue({ code: 'custom', path: ['maxTerm'], message: 'El plazo máximo debe ser mayor o igual al mínimo' })
    if (p.referenceAmount < p.minAmount || p.referenceAmount > p.maxAmount)
      ctx.addIssue({ code: 'custom', path: ['referenceAmount'], message: 'El monto de referencia debe estar dentro del rango' })
    if (p.referenceTerm < p.minTerm || p.referenceTerm > p.maxTerm)
      ctx.addIssue({ code: 'custom', path: ['referenceTerm'], message: 'El plazo de referencia debe estar dentro del rango' })
  })

const pricingProducts = z
  .object({ products: z.array(productSchema).min(1, 'Al menos un producto').max(6) })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.products.forEach((p, i) => {
      if (seen.has(p.type)) ctx.addIssue({ code: 'custom', path: ['products', i, 'type'], message: 'Producto repetido' })
      seen.add(p.type)
    })
  })

const cftMethod = z.object({
  method: z.enum(['tea_por_iva', 'flujo_completo']),
  ivaPct: z.number().finite().min(0).max(30),
  includesInsurance: z.boolean(),
  includesOriginationFees: z.boolean(),
  note: text(0, 800),
})

const charges = z.object({
  originationFeePct: z.number().finite().min(0).max(15),
  insurancePct: z.number().finite().min(0).max(10),
  punitiveRateMonthlyPct: z.number().finite().min(0).max(50),
})

const merchantCommissions = z.object({
  schedule: z
    .array(
      z.object({
        plan: text(2, 60),
        commissionPct: z.number().finite().min(0).max(30),
        settlementDays: z.number().int().min(0).max(60),
        notes: text(0, 200),
      }),
    )
    .max(12),
})

/* ------------------------------ Textos ------------------------------ */

const heroSubtitle = z.object({ text: text(20, 400) })
const announcement = z.object({ enabled: z.boolean(), text: text(0, 240) })

/* ------------------------------ Documentación legal ------------------------------ */

const legalDoc = z.object({
  title: text(3, 120),
  versionLabel: text(1, 60),
  effectiveFrom: isoDate,
  summary: text(0, 400),
  body: text(0, 20000),
})

/* ------------------------------ Parámetros ------------------------------ */

const contact = z.object({
  supportEmail: z.string().trim().email('Email inválido').max(120),
  privacyEmail: z.string().trim().email('Email inválido').max(120),
  phone: text(0, 40),
})
const dti = z.object({ ratio: z.number().finite().min(0.05, 'Mínimo 5%').max(0.6, 'Máximo 60%') })

const LEGAL_EFFECTIVE = '2026-08-30'
const legalFields: FieldSpec[] = [
  { name: 'title', label: 'Título', type: 'text', maxLength: 120 },
  { name: 'versionLabel', label: 'Versión', type: 'text', maxLength: 60, help: 'Ej.: TCG-v9.3' },
  { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', help: 'Fecha de entrada en vigencia que se muestra en la lista de documentación.' },
  { name: 'summary', label: 'Resumen', type: 'textarea', maxLength: 400 },
  {
    name: 'body',
    label: 'Texto completo (opcional)',
    type: 'textarea',
    maxLength: 20000,
    help: 'Si se completa y se publica con visibilidad pública, se muestra en /legal/documentos/<documento>. Párrafos separados por línea en blanco.',
  },
]

function legalDef(slug: string, title: string, versionLabel: string, desc: string): ConfigDefinition {
  return {
    key: `legal.${slug}`,
    kind: 'legal_document',
    tab: 'legal',
    label: title,
    description: desc,
    sensitivity: 'legal',
    schema: legalDoc,
    defaults: { title, versionLabel, effectiveFrom: LEGAL_EFFECTIVE, summary: '', body: '' },
    fields: legalFields,
    preview: 'legal',
    wired: true,
    wiredNote: 'La lista /legal/documentos muestra título, versión y fecha de vigencia publicados.',
  }
}

const productFields: FieldSpec[] = [
  {
    name: 'products',
    label: 'Productos',
    type: 'rows',
    maxRows: 6,
    addLabel: 'Agregar producto',
    rows: [
      {
        name: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'personal', label: 'Personal' },
          { value: 'consumo', label: 'Consumo' },
          { value: 'comercio', label: 'Comercio' },
        ],
      },
      { name: 'name', label: 'Nombre comercial', type: 'text', maxLength: 80 },
      { name: 'monthlyRate', label: 'Tasa mensual (TEM)', type: 'number', step: 0.01, suffix: '%' },
      { name: 'minAmount', label: 'Monto mínimo', type: 'number', step: 1000, suffix: '$' },
      { name: 'maxAmount', label: 'Monto máximo', type: 'number', step: 1000, suffix: '$' },
      { name: 'minTerm', label: 'Plazo mínimo', type: 'number', step: 1, suffix: 'meses' },
      { name: 'maxTerm', label: 'Plazo máximo', type: 'number', step: 1, suffix: 'meses' },
      { name: 'referenceAmount', label: 'Monto de referencia', type: 'number', step: 1000, suffix: '$' },
      { name: 'referenceTerm', label: 'Plazo de referencia', type: 'number', step: 1, suffix: 'meses' },
    ],
  },
]

const DEFINITIONS_LIST: ConfigDefinition[] = [
  {
    key: 'pricing.products',
    kind: 'setting',
    tab: 'comisiones',
    label: 'Tasas y rangos por producto',
    description: 'Tasa mensual, montos y plazos del catálogo. Hoy salen de lib/loan-catalog.ts.',
    sensitivity: 'pricing',
    schema: pricingProducts,
    defaults: {
      products: LOAN_CATALOG.map((p) => ({
        type: p.type,
        name: p.name,
        monthlyRate: p.monthlyRate,
        minAmount: p.minAmount,
        maxAmount: p.maxAmount,
        minTerm: p.minTerm,
        maxTerm: p.maxTerm,
        referenceAmount: p.referenceAmount,
        referenceTerm: p.referenceTerm,
      })),
    },
    fields: productFields,
    preview: 'pricing',
    wired: false,
    wiredNote: 'Solo se guarda. No alimenta el simulador, la página de tasas ni los créditos: el catálogo sigue saliendo del código.',
  },
  {
    key: 'pricing.cft_method',
    kind: 'setting',
    tab: 'comisiones',
    label: 'Método del CFT',
    description: 'Cómo se calcula y se explica el CFT publicado. Hoy: TEA × 1,21 (IVA sobre intereses).',
    sensitivity: 'pricing',
    schema: cftMethod,
    defaults: { method: 'tea_por_iva', ivaPct: 21, includesInsurance: false, includesOriginationFees: false, note: LEGAL_COPY.cftLong },
    fields: [
      {
        name: 'method',
        label: 'Método',
        type: 'select',
        options: [
          { value: 'tea_por_iva', label: 'TEA × (1 + IVA) — interés más IVA' },
          { value: 'flujo_completo', label: 'Flujo completo (TIR de todos los cargos)' },
        ],
      },
      { name: 'ivaPct', label: 'IVA sobre intereses', type: 'number', step: 0.5, suffix: '%' },
      { name: 'includesInsurance', label: 'Incluye seguros', type: 'boolean' },
      { name: 'includesOriginationFees', label: 'Incluye gastos de otorgamiento', type: 'boolean' },
      { name: 'note', label: 'Nota pública sobre el CFT', type: 'textarea', maxLength: 800 },
    ],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda. El motor (lib/finance.ts) sigue usando TEA × 1,21.',
  },
  {
    key: 'pricing.charges',
    kind: 'setting',
    tab: 'comisiones',
    label: 'Cargos al cliente',
    description: 'Gastos de otorgamiento, seguros y punitorios. Hoy: todos en 0%.',
    sensitivity: 'pricing',
    schema: charges,
    defaults: { originationFeePct: 0, insurancePct: 0, punitiveRateMonthlyPct: 0 },
    fields: [
      { name: 'originationFeePct', label: 'Gastos de otorgamiento', type: 'number', step: 0.1, suffix: '% del capital' },
      { name: 'insurancePct', label: 'Seguro', type: 'number', step: 0.1, suffix: '% del capital' },
      { name: 'punitiveRateMonthlyPct', label: 'Punitorios (mensual)', type: 'number', step: 0.1, suffix: '%' },
    ],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda. Hoy no se cobran gastos, seguros ni punitorios y los créditos firmados no cambian.',
  },
  {
    key: 'pricing.merchant_commissions',
    kind: 'setting',
    tab: 'comisiones',
    label: 'Comisiones de comercios',
    description: 'Esquema de comisión por plan y plazo de liquidación. Hoy no hay un esquema general: se informa al adherir cada local.',
    sensitivity: 'pricing',
    schema: merchantCommissions,
    defaults: { schedule: [] },
    fields: [
      {
        name: 'schedule',
        label: 'Esquema',
        type: 'rows',
        maxRows: 12,
        addLabel: 'Agregar plan',
        rows: [
          { name: 'plan', label: 'Plan', type: 'text', maxLength: 60 },
          { name: 'commissionPct', label: 'Comisión', type: 'number', step: 0.01, suffix: '%' },
          { name: 'settlementDays', label: 'Liquidación', type: 'number', step: 1, suffix: 'días' },
          { name: 'notes', label: 'Notas', type: 'text', maxLength: 200 },
        ],
      },
    ],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda. La comisión sigue definiéndose por comercio (merchant.commissionRate).',
  },
  {
    key: 'home.hero_subtitle',
    kind: 'content_block',
    tab: 'textos',
    label: 'Portada: subtítulo principal',
    description: 'Párrafo bajo el título de la portada.',
    sensitivity: 'normal',
    schema: heroSubtitle,
    defaults: {
      text: 'Elegí monto y plazo, mirá la cuota, la TNA y el CFT reales y recién después creá tu cuenta. Te mostramos el costo completo, incluso cuando es alto.',
    },
    fields: [{ name: 'text', label: 'Texto', type: 'textarea', maxLength: 400 }],
    preview: 'text',
    wired: true,
    wiredNote: 'La portada (/) lo lee de la base cuando hay una versión publicada.',
  },
  {
    key: 'home.announcement',
    kind: 'content_block',
    tab: 'textos',
    label: 'Aviso destacado',
    description: 'Mensaje corto para una franja de avisos (ej.: horarios, feriados).',
    sensitivity: 'normal',
    schema: announcement,
    defaults: { enabled: false, text: '' },
    fields: [
      { name: 'enabled', label: 'Mostrar el aviso', type: 'boolean' },
      { name: 'text', label: 'Texto', type: 'text', maxLength: 240 },
    ],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda: la franja de avisos todavía no existe en la web.',
  },
  legalDef('terminos', 'Términos y Condiciones Generales', LEGAL_TCG_VERSION, 'TCG del servicio (/legal/terminos).'),
  legalDef('privacidad', 'Política de privacidad', LEGAL_PRIVACY_VERSION, 'Tratamiento de datos personales (/legal/privacidad).'),
  legalDef('tasas', 'Comisiones, cargos y tasas', `Revisión ${LEGAL_REVISION}`, 'Documento de transparencia de costos (/legal/tasas).'),
  legalDef('arrepentimiento', 'Botón de arrepentimiento', `Revisión ${LEGAL_REVISION}`, 'Derecho de revocación (/legal/arrepentimiento).'),
  legalDef('baja', 'Botón de baja', `Revisión ${LEGAL_REVISION}`, 'Baja del servicio (/legal/baja).'),
  legalDef('defensa-consumidor', 'Defensa del consumidor', `Revisión ${LEGAL_REVISION}`, 'Canales de reclamo (/legal/defensa-consumidor).'),
  legalDef('usuario-financiero', 'Usuario de servicios financieros', `Revisión ${LEGAL_REVISION}`, 'Información al usuario financiero (/legal/usuario-financiero).'),
  {
    key: 'params.contact',
    kind: 'setting',
    tab: 'parametros',
    label: 'Contacto institucional',
    description: 'Emails y teléfono públicos. Hoy salen de variables de entorno.',
    sensitivity: 'normal',
    schema: contact,
    defaults: { supportEmail: BRAND.supportEmail, privacyEmail: BRAND.privacyEmail, phone: BRAND.phone },
    fields: [
      { name: 'supportEmail', label: 'Email de soporte', type: 'text', maxLength: 120 },
      { name: 'privacyEmail', label: 'Email de privacidad', type: 'text', maxLength: 120 },
      { name: 'phone', label: 'Teléfono', type: 'text', maxLength: 40 },
    ],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda. Los mails siguen saliendo de BRAND / variables de entorno.',
  },
  {
    key: 'params.income_dti_ratio',
    kind: 'setting',
    tab: 'parametros',
    label: 'Tope de cuota sobre ingresos',
    description: 'Porcentaje máximo del ingreso declarado que puede ser la cuota (hoy 35%).',
    sensitivity: 'pricing',
    schema: dti,
    defaults: { ratio: INCOME_DTI_RATIO },
    fields: [{ name: 'ratio', label: 'Proporción (0,35 = 35%)', type: 'number', step: 0.01 }],
    preview: 'generic',
    wired: false,
    wiredNote: 'Solo se guarda. El motor de originación sigue usando la constante del código.',
  },
]

export const DEFINITIONS: Record<string, ConfigDefinition> = Object.fromEntries(DEFINITIONS_LIST.map((d) => [d.key, d]))
export const DEFINITION_LIST: readonly ConfigDefinition[] = DEFINITIONS_LIST

export function getDefinition(key: string): ConfigDefinition | null {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, key) ? DEFINITIONS[key] : null
}

export function definitionsForTab(tab: ConfigTab): ConfigDefinition[] {
  return DEFINITIONS_LIST.filter((d) => d.tab === tab)
}

export const TAB_LABEL: Record<ConfigTab, string> = {
  comisiones: 'Comisiones y tasas',
  textos: 'Textos de la web',
  legal: 'Documentación legal',
  parametros: 'Parámetros',
}

export const LEGAL_DOC_KEYS = DEFINITIONS_LIST.filter((d) => d.kind === 'legal_document').map((d) => d.key)

/** Clave pública de la ruta existente de cada documento (para la lista de documentación). */
export const LEGAL_DOC_PATH: Record<string, string> = {
  'legal.terminos': '/legal/terminos',
  'legal.privacidad': '/legal/privacidad',
  'legal.tasas': '/legal/tasas',
  'legal.arrepentimiento': '/legal/arrepentimiento',
  'legal.baja': '/legal/baja',
  'legal.defensa-consumidor': '/legal/defensa-consumidor',
  'legal.usuario-financiero': '/legal/usuario-financiero',
}
