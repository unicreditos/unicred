/**
 * Textos legales canónicos para contratos, TCG, privacidad y documentos imprimibles.
 * Una sola fuente evita inconsistencias (fuero, BCRA, CFT, PNFC, mutuo).
 */

import { BRAND, legalPartyLine } from '@/lib/brand'

export const LEGAL_REVISION = '30/08/2026'
export const LEGAL_TCG_VERSION = 'TCG-v9.2'
export const LEGAL_PRIVACY_VERSION = 'Privacy-v4.1'

export const LEGAL_COPY = {
  contractTitle: 'Contrato de préstamo (mutuo con interés) y emisión de pagaré',
  contractSubtitlePersonal: 'Préstamo personal · mutuo con interés (CCCN arts. 1525 y ss.)',
  contractSubtitleComercial: 'Préstamo comercial · mutuo con interés (CCCN arts. 1525 y ss.)',
  pagareSubtitle: 'Decreto-Ley 5965/63 · accesorio del contrato de préstamo (mutuo) UNICRÉDITOS',

  /** Mutuo = nombre legal del préstamo de dinero en Argentina. */
  mutuoExplain:
    'El “mutuo con interés” es el contrato de préstamo de dinero del Código Civil y Comercial (arts. 1525 y ss.). “Préstamo” y “mutuo” designan el mismo negocio jurídico.',

  nonBank:
    'UNICRÉDITOS no es una entidad financiera autorizada por el BCRA, no capta depósitos del público y no afirma inscripción como Proveedor No Financiero de Crédito (PNFC) hasta publicar constancia oficial.',

  cftShort:
    'TNA = tasa mensual × 12. CFT publicado = TEA × 1,21 (IVA 21% sobre intereses). Hoy no se suman seguros ni gastos de otorgamiento al deudor; si se cobran en el futuro, se informan antes de firmar.',

  cftLong:
    'El CFT publicado es el costo del interés más IVA (TEA × 1,21), calculado por el motor UNICRÉDITOS. No es el indicador metodológico completo de un régimen de transparencia BCRA de entidad inscripta. Si hubiera otros cargos, se incluirían en la oferta antes de firmar.',

  cftContractNote:
    'El CFT se informa como TEA × 1,21 (IVA 21% sobre intereses), sin seguros ni gastos de otorgamiento al deudor en la versión vigente. No es el CFT metodológico de flujos de un sujeto BCRA. La simulación previa es informativa; rigen este contrato y la liquidación de cada cuota. TEA, TNA y CFT se consignan en la sección de costo.',

  cftPublicLabel: 'CFT est. (IVA sobre intereses)',

  punitorios:
    'La tasa de interés punitorio de este mutuo es 0% (cero). UNICRÉDITOS no liquida ni capitaliza punitorios. En mora se exige el capital y los intereses compensatorios de la cuota vencida, más costas razonables de cobranza si correspondieran.',

  walletLedger:
    'El saldo de la billetera UNICRÉDITOS es un ledger interno. No es un CVU ni un alias Coelsa, ni una cuenta de un PSP inscripto. El crédito se acredita en el CBU, CVU o alias bancario a tu nombre cargado en Cuentas de desembolso.',

  feAnnex:
    'El recibo interno no reemplaza la factura electrónica ARCA del IVA sobre intereses. Esa factura se emite (o queda en cola de CAE) al cobrar cada cuota.',

  /** Consulta BCRA: sí con autorización. Reporte: solo si el régimen lo permite. */
  bcraConsulta:
    'Con tu autorización se consulta la Central de Deudores del BCRA y fuentes permitidas para evaluar el crédito.',

  bcraReporte:
    'Los atrasos relevantes podrán informarse a bases de informes comerciales y, únicamente cuando corresponda según el régimen de información vigente y la normativa aplicable, a la Central de Deudores del BCRA. No se afirma capacidad de reporte BCRA si la sociedad no está alcanzada por ese régimen.',

  bcraReporteShort:
    'El atraso podrá informarse a bases de informes comerciales y, solo si el régimen aplicable lo habilita, a la Central de Deudores del BCRA.',

  uif:
    'UNICRÉDITOS aplica controles razonables ALA/FT (Ley 25.246). No afirma inscripción como sujeto obligado UIF hasta publicarla.',

  jurisdiction:
    'Ley de la República Argentina. Fuero preferente: tribunales ordinarios de la Ciudad Autónoma de Buenos Aires. Si el Prestatario es consumidor (Ley 24.240), puede demandar en el domicilio de su consumo; esa opción no puede renunciarse.',

  jurisdictionShort:
    'Ley argentina. Fuero preferente CABA. El consumidor puede demandar en su domicilio (Ley 24.240); no hay renuncia válida de ese fuero.',

  arrepentimiento:
    'En contrataciones a distancia podés arrepentirte dentro de los 10 días corridos desde la aceptación del contrato (Ley 24.240 art. 34) si el crédito todavía no se acreditó. Si ya se acreditó, corresponde devolver el capital o cancelar anticipadamente.',

  noWhatsapp0800: 'No hay WhatsApp ni 0800 publicado como canal habilitado.',

  partyLine: () => legalPartyLine(),
  supportEmail: () => BRAND.supportEmail,
  privacyEmail: () => BRAND.privacyEmail,
} as const
