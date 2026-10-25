/**
 * Vocabulario único de estados, métodos y tipos. TODA pantalla, documento y correo usa estos textos: no se repiten
 * diccionarios en otros archivos. Si aparece un valor nuevo en la base, se agrega acá.
 */

type Tone = 'secondary' | 'reviewing' | 'success' | 'destructive' | 'warning'

/* -------------------------------- Créditos -------------------------------- */

export const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: 'En evaluación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  active: 'Vigente',
  paid: 'Cancelado',
  cancelled: 'Anulado',
  disbursed: 'Desembolsado',
}

export const LOAN_STATUS_BADGE: Record<string, Tone> = {
  pending: 'reviewing',
  approved: 'warning',
  rejected: 'destructive',
  active: 'success',
  paid: 'secondary',
  cancelled: 'secondary',
  disbursed: 'success',
}

/* ------------------------ Cobros con QR (Mercado Pago) ------------------------ */

export const QR_ORDER_STATUS_LABELS: Record<string, string> = {
  creating: 'Generando',
  created: 'Esperando el pago',
  paid: 'Cobrado',
  expired: 'Vencido',
  cancelled: 'Anulado',
  failed: 'No se generó',
}

export const QR_ORDER_STATUS_BADGE: Record<string, Tone> = {
  creating: 'secondary',
  created: 'reviewing',
  paid: 'success',
  expired: 'secondary',
  cancelled: 'secondary',
  failed: 'destructive',
}

export const QR_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En proceso',
  credited: 'Acreditado',
  rejected: 'Rechazado',
  reversed: 'Devuelto',
  reversal_pending: 'Devolución pendiente',
  unmatched: 'Sin asignar',
  ignored: 'Ignorado',
}

export const QR_PAYMENT_STATUS_BADGE: Record<string, Tone> = {
  pending: 'reviewing',
  credited: 'success',
  rejected: 'destructive',
  reversed: 'secondary',
  reversal_pending: 'destructive',
  unmatched: 'warning',
  ignored: 'secondary',
}

/** Cómo se identificó a quién pertenece un pago recibido por QR. */
export const QR_MATCH_LABELS: Record<string, string> = {
  order: 'por la orden',
  reference: 'por la referencia',
  pos_reference: 'por la caja',
  pos_id: 'por la caja',
}

/** Medios con los que paga quien escanea el QR (códigos de Mercado Pago). */
export const MP_METHOD_LABELS: Record<string, string> = {
  account_money: 'Dinero en cuenta',
  debvisa: 'Débito Visa',
  debmaster: 'Débito Mastercard',
  debcabal: 'Débito Cabal',
  visa: 'Crédito Visa',
  master: 'Crédito Mastercard',
  amex: 'American Express',
  cabal: 'Crédito Cabal',
  naranja: 'Naranja',
  bank_transfer: 'Transferencia',
  interop_transfer: 'Transferencia por QR interoperable',
  consumer_credits: 'Crédito de Mercado Pago',
}

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'A vencer',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
  partial: 'Pago parcial',
}

export const INSTALLMENT_STATUS_BADGE: Record<string, Tone> = {
  pending: 'secondary',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
  partial: 'warning',
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  generated: 'Emitido',
  pending_acceptance: 'Pendiente de firma',
  accepted: 'Firmado',
  rejected: 'Rechazado',
  withdrawn: 'Dejado sin efecto',
}

export const DISBURSEMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  credited: 'Acreditado',
  completed: 'Acreditado',
  cancelled: 'Cancelado',
  reversed: 'Revertido',
  failed: 'Fallido',
}

/* ---------------------------------- Pagos --------------------------------- */

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  paid: 'Acreditado',
  failed: 'Fallido',
  expired: 'Vencido',
  cancelled: 'Cancelado',
  refunded: 'Reintegrado',
}

export const PAYMENT_STATUS_BADGE: Record<string, Tone> = {
  pending: 'reviewing',
  processing: 'reviewing',
  paid: 'success',
  failed: 'destructive',
  expired: 'secondary',
  cancelled: 'secondary',
  refunded: 'warning',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transferencia_bancaria: 'Transferencia bancaria',
  transferencia_rm: 'Transferencia bancaria',
  bank_transfer: 'Transferencia bancaria',
  cbu: 'Transferencia CBU',
  cvu: 'Transferencia CVU',
  mercado_pago: 'Mercado Pago',
  mercadopago_wallet: 'Mercado Pago',
  link_pago: 'Link de pago',
  pago_facil: 'Pago Fácil',
  rapipago: 'Rapipago',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  payway_card: 'Tarjeta',
  payway_qr: 'Pago con QR',
  payway_wallet: 'Billetera UNICRÉDITOS',
  wallet: 'Billetera UNICRÉDITOS',
  billetera_unicreditos: 'Billetera UNICRÉDITOS',
  debito_automatico: 'Débito automático',
  efectivo: 'Efectivo',
}

export const RECEIPT_TYPE_LABELS: Record<string, string> = {
  payment: 'Recibo de pago',
  disbursement: 'Comprobante de desembolso',
  service_payment: 'Pago de servicio',
  early_settlement: 'Cancelación anticipada',
}

/* --------------------------- Billetera y tesorería ------------------------- */

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  queued: 'Pendiente de aprobación',
  executed: 'Enviado',
  cancelled: 'Cancelado',
  failed: 'Rechazado',
}

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  queued: 'En proceso',
  executed: 'Pagado',
  failed: 'Devuelto',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  queued: 'En cola',
  emitting: 'Emitiendo',
  pending_cae: 'Esperando CAE',
  authorized: 'Autorizada',
  failed: 'Con error',
}

/* ---------------------------- Personas y servicios ------------------------- */

export const MERCHANT_STATUS_LABELS: Record<string, string> = {
  pending: 'En revisión',
  active: 'Adherido',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
}

export const MERCHANT_STATUS_BADGE: Record<string, Tone> = {
  pending: 'reviewing',
  active: 'success',
  rejected: 'destructive',
  suspended: 'secondary',
}

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  in_review: 'En curso',
  resolved: 'Resuelta',
  closed: 'Cerrada',
}

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  cobros: 'Cobros y pagos',
  identidad: 'Verificación de identidad',
  desembolso: 'Desembolso y billetera',
  contrato: 'Contrato y firma',
  comercio: 'Comercios',
  otro: 'Otro',
  mobile_chat: 'Chat desde la app',
}

export const LOAN_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal',
  comercio: 'Comercio',
  merchant: 'Comercio',
  express: 'Express',
}

/* ---------------------------- Auditoría (acciones) ------------------------- */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ADMIN_VIEW: 'Consulta de pantalla',
  ARCA_SALES_POINT_VERSIONED: 'Punto de venta de ARCA actualizado',
  DEBT_CHECK_SKIPPED: 'Validación de deuda omitida',
  DEBT_CHECK_UNAVAILABLE: 'Validación de deuda no disponible',
  DEBT_CHECK_AT_SIGNING: 'Validación de deuda al firmar',
  LOAN_DISBURSED_TO_WALLET: 'Crédito acreditado en la billetera',
  WALLET_BULK_CREATED: 'Billeteras creadas en lote',
  ARCA_CONSULTED_THIRD_PARTY: 'Consulta a ARCA sobre otra persona',
  BCRA_CONSULTED_THIRD_PARTY: 'Consulta al BCRA sobre otra persona',
  CBU_LOOKUP_ADMIN: 'Consulta de CBU desde administración',
  KYC_SESSION_STARTED: 'Verificación de identidad iniciada',
  PROFILE_PERSONAL_DATA_SAVED: 'Datos personales guardados',
  BCRA_CONSENT_GRANTED: 'Consentimiento para consultar el BCRA',
  MERCHANT_DOCUMENT_VIEWED: 'Documento de comercio abierto',
  AUTH_LOGIN: 'Ingreso',
  AUTH_LOGIN_FAILED: 'Ingreso fallido',
  AUTH_LOGOUT: 'Salida',
  AUTH_RESET_REQUESTED: 'Pedido de nueva contraseña',
  AUTH_PASSWORD_RESET: 'Contraseña restablecida',
  DOCUMENT_VIEWED: 'Documento abierto',
  LOAN_AUTO_QUALIFIED: 'Crédito calificado automáticamente',
  LOAN_AUTO_REJECTED: 'Crédito rechazado automáticamente',
  LOAN_SENT_TO_REVIEW: 'Crédito enviado a revisión',
  LOAN_APPROVED: 'Crédito aprobado',
  LOAN_REJECTED: 'Crédito rechazado',
  LOAN_WITHDRAWN: 'Arrepentimiento',
  LOAN_REFINANCED: 'Crédito refinanciado',
  LOAN_EARLY_SETTLEMENT: 'Cancelación anticipada',
  CONTRACT_GENERATED: 'Contrato emitido',
  CONTRACT_SIGNED: 'Contrato firmado',
  SIGNATURE_SELFIE_SUBMITTED: 'Selfie de firma enviada',
  SIGNATURE_CHECK_APPROVED: 'Validación de firma aprobada',
  SIGNATURE_CHECK_REJECTED: 'Validación de firma rechazada',
  DISBURSEMENT_CREDITED: 'Desembolso acreditado',
  DISBURSEMENT_AUTO_PENDING: 'Desembolso automático pendiente',
  INSTALLMENTS_PAID_WALLET: 'Cuotas pagadas con la billetera',
  INTIMATION_ISSUED: 'Intimación emitida',
  COLLECTION_CONTACT: 'Contacto de cobranza',
  WALLET_CREATED: 'Billetera creada',
  WALLET_CREDITED: 'Billetera acreditada',
  WALLET_ADJUST_CREDIT: 'Ajuste a favor',
  WALLET_ADJUST_DEBIT: 'Ajuste en contra',
  WALLET_PAYOUT_REQUESTED: 'Retiro solicitado',
  WALLET_PAYOUT_EXECUTED: 'Retiro enviado',
  WALLET_PAYOUT_CANCELLED: 'Retiro cancelado',
  BANK_ACCOUNT_ADDED: 'Cuenta bancaria agregada',
  BANK_ACCOUNT_ADDED_MANUAL: 'Cuenta bancaria cargada a mano',
  BANK_ACCOUNT_VERIFIED: 'Cuenta bancaria verificada',
  BANK_ACCOUNT_VERIFIED_MANUAL: 'Cuenta verificada a mano',
  BANK_ACCOUNT_REJECTED: 'Cuenta bancaria rechazada',
  SERVICE_PAYMENT: 'Pago de servicio',
  SERVICE_SETTLED: 'Servicio liquidado',
  SERVICE_REFUNDED: 'Servicio devuelto',
  KYC_REVIEWED: 'Identidad revisada',
  KYC_REJECTED: 'Identidad rechazada',
  KYC_MEDIA_VIEWED: 'Imágenes de identidad abiertas',
  MERCHANT_REGISTERED: 'Comercio registrado',
  MERCHANT_APPROVED: 'Comercio habilitado',
  MERCHANT_ACTIVATED: 'Comercio habilitado',
  MERCHANT_REJECTED: 'Comercio rechazado',
  MERCHANT_SUSPENDED: 'Comercio suspendido',
  OPERATOR_ADDED: 'Operador agregado',
  OPERATOR_REMOVED: 'Operador dado de baja',
  OPERATOR_ROLE_CHANGED: 'Rol de operador cambiado',
  ADMIN_ROLE_ASSIGNED: 'Rol de operador asignado',
  USER_BANNED: 'Cuenta bloqueada',
  USER_UNBANNED: 'Cuenta desbloqueada',
  USER_EDITED: 'Datos de la persona editados',
  USER_DELETED: 'Cuenta eliminada',
  RISK_RULES_VERSIONED: 'Reglas de riesgo publicadas',
  PRODUCT_CREATED: 'Producto creado',
  PRODUCT_UPDATED: 'Producto actualizado',
  CLAIM_CREATED: 'Reclamo presentado',
  SUPPORT_CASE_RESOLVED: 'Consulta resuelta',
  ARCA_INVOICE_EMITTED: 'Factura emitida',
  ARCA_INVOICE_FAILED: 'Factura con error',
  ACCESS_DENIED: 'Acceso denegado',
  REPORT_EXPORTED: 'Reporte exportado',
  TWO_FACTOR_RESET: 'Verificación en dos pasos quitada',
  SERVICE_CONFLICT: 'Pago de servicio confirmado después de devolverlo',
  SERVICE_NEEDS_REVIEW: 'Pago de servicio sin resolver en la red',
  NOTE_ADDED: 'Nota interna agregada',
  NOTE_DELETED: 'Nota interna borrada',
  DATA_EXPORT: 'Copia de datos descargada',
  DATA_RIGHT_REQUESTED: 'Pedido sobre datos personales',
  REMINDERS_RUN: 'Recordatorios de cuotas enviados',
  MP_QR_POS_CREATED: 'Caja de cobro QR activada',
  MP_QR_CREDITED: 'Cobro QR acreditado',
  MP_QR_REVERSED: 'Cobro QR devuelto',
  MP_QR_ATTENTION: 'Pago QR para revisar',
  MP_QR_SYNC: 'Cobros QR conciliados',
}

/** Texto de una acción de auditoría; si no está en la lista, el código sin guiones bajos. */
export function auditActionLabel(code: string) {
  return AUDIT_ACTION_LABELS[code] ?? code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** Texto del diccionario, o el valor legible si no está (nunca se muestra un código crudo con guiones bajos). */
export function label(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return '—'
  return map[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
