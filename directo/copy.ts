/**
 * Copy de la campaña /directo.
 * No toca LEGAL_COPY ni el sitio institucional. El crédito se origina
 * en el flujo ya construido: cuenta → KYC Didit → BCRA → mutuo → desembolso.
 */

import { BRAND, GROUP, groupOperatorLine } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'

export const DIRECTO_CTA_HREF = '/sign-up'
export const DIRECTO_HOME = '/directo'
export const DIRECTO_PRODUCTOS = '/directo/productos'

export const DIRECTO_NAV = [
  { href: DIRECTO_HOME, label: 'Inicio' },
  { href: DIRECTO_PRODUCTOS, label: 'Productos' },
  { href: '/legal/privacidad', label: 'Política de Privacidad' },
  { href: '/legal/terminos', label: 'Términos y Condiciones' },
] as const

export const DIRECTO = {
  heroKicker: `${GROUP.productLine} · Crédito en línea`,
  heroTitle: 'Pedí tu crédito en línea. Empresa real. Sin hostigamiento.',
  heroLead: `${groupOperatorLine()} Sociedad argentina con domicilio e inscripción IGJ. Solicitás por internet; la identidad, el contrato y el desembolso siguen el expediente que ya opera: Didit, Central de Deudores, mutuo y acreditación en tu CBU o CVU.`,
  ctaPrimary: 'Solicitá ahora',
  ctaSecondary: 'Ver cómo funciona',
  fundsLine: 'Si la oferta se firma, el dinero va a tu cuenta. No a un intermediario opaco.',
  fundsHint:
    'El plazo de acreditación lo confirma tesorería. No prometemos minutos ni horas fijas.',

  whyTitle: 'Por qué elegir UNICRÉDITOS',
  whyLead: 'Hay plataformas que aprietan cuando más lo necesitás. Acá el trato es otro.',
  reasons: [
    {
      n: '1',
      t: 'Empresa constituida, no un formulario fantasma',
      d: `${BRAND.legalName} (${BRAND.legalForm}). CUIT ${BRAND.cuit}. Inscripta en IGJ el ${BRAND.incorporated}. Domicilio en ${BRAND.city}.`,
    },
    {
      n: '2',
      t: 'Cuota, TNA y CFT antes de firmar',
      d: 'Ves el costo en la misma pantalla. La oferta y el contrato de préstamo (mutuo) confirman los números. Sin letra chica de último momento.',
    },
    {
      n: '3',
      t: 'Sin hostigamiento',
      d: 'No perseguimos a nadie por WhatsApp, llamadas infinitas ni amenazas. Si hay mora, se gestiona con el panel, recibos e instrumentos formales.',
    },
    {
      n: '4',
      t: 'Tus datos no se venden para cobranza agresiva',
      d: 'Identidad con Didit, consulta a la Central de Deudores con tu autorización, privacidad Ley 25.326. Canal de soporte por correo, no por números que no publicamos.',
    },
  ],

  stepsTitle: 'Tu crédito, en tres pasos',
  stepsLead: 'Todo el proceso es en línea. Lo que ya está construido no se salta: se usa.',
  steps: [
    {
      n: '1',
      t: 'Solicitud en línea',
      d: 'Creá tu cuenta y pedí el monto. En minutos completás el formulario. Eso no es una aprobación.',
    },
    {
      n: '2',
      t: 'Verificación real',
      d: 'Didit (DNI y prueba de vida) y consulta a la Central de Deudores del BCRA. Sin sucursal y sin atajos.',
    },
    {
      n: '3',
      t: 'Contrato y desembolso',
      d: 'Si calificás, ves la oferta con TNA, CFT y plan. Firmás el mutuo y el pagaré. Recién ahí acreditamos en tu CBU o CVU.',
    },
  ],

  contrastTitle: 'Otra forma de pedir un crédito',
  contrastLead:
    'No copiamos el modelo de aprobación relámpago para después presionar. UNICRÉDITOS existe para que quien necesita un crédito tenga una empresa de verdad, un contrato y un trato humano.',
  weDont: [
    'No hostigamos, no amenazamos y no vendemos tu urgencia a cobradores de pasillo.',
    'No prometemos aprobación mágica ni plata en minutos. Eso es el anzuelo de siempre.',
    'No ocultamos el costo. Si no ves TNA y CFT, no firmes en ningún lado — tampoco acá.',
    'No somos un banco ni afirmamos inscripción PNFC. Lo decimos en la web y en el contrato.',
  ],
  weDo: [
    'Sociedad por Acciones Simplificada, con CUIT y domicilio publicados.',
    'Contrato de préstamo (mutuo), pagaré, cronograma y recibos en tu panel.',
    'Evaluación con identidad verificada e ingresos. Tope de cuota sobre lo que declarás.',
    'Arrepentimiento en contrataciones a distancia, según Ley 24.240.',
  ],

  productTitle: 'Crédito personal en línea',
  productLead: `Hasta ${formatARS(FIRST_CREDIT_HARD_CAP)} en el primer crédito; el catálogo llega a ${formatARS(PERSONAL_QUOTE.maxAmount)} con historial.`,
  productMetric: PERSONAL_QUOTE.metric,
  productHint: PERSONAL_QUOTE.metricHint,

  needTitle: 'Qué vas a necesitar',
  needItems: ['DNI y CUIL a tu nombre', 'CBU o CVU del titular', 'Ingresos netos comprobables'],

  contactTitle: 'Estamos para ayudarte',
  contactLead: 'Escribinos. No hay WhatsApp ni 0800 como canal habilitado.',
  contactEmail: BRAND.supportEmail,

  companyLine: `${BRAND.legalName} · CUIT ${BRAND.cuit} · ${BRAND.address}`,
  nonBank: LEGAL_COPY.nonBank,
  mutuo: LEGAL_COPY.mutuoExplain,
  cft: LEGAL_COPY.cftShort,
  bcra: LEGAL_COPY.bcraConsulta,
  arrepentimiento: LEGAL_COPY.arrepentimiento,
  disclaimer:
    'La simulación es informativa y no constituye oferta ni aprobación. Cada crédito se decide con KYC, Central de Deudores e ingresos. El desembolso ocurre después de firmar el contrato, en el CBU o CVU a tu nombre.',
} as const
