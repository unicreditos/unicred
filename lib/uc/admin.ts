import type { MenuItem } from '@/components/uc/shell'
import type { Tone } from '@/components/uc/grid-types'
import type { AdminDeskState, Client } from '@/lib/admin-desk/types'
import type { PermissionKey } from '@/lib/rbac'

/* ------------------------------ Menú ------------------------------ */

type Leaf = { label: string; route: string; perm?: PermissionKey; anyOf?: PermissionKey[] }
type Group = { id: string; label: string; icon: MenuItem['icon']; route?: string; perm?: PermissionKey; children?: Leaf[] }

const CONTENT_PERMS: PermissionKey[] = ['content.edit', 'content.publish', 'pricing.publish']

const GROUPS: Group[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home', route: '/admin' },
  { id: 'panel-control', label: 'Panel de Control', icon: 'chart', route: '/admin/panel-control', perm: 'finance.read' },
  {
    id: 'originacion',
    label: 'Originación',
    icon: 'origin',
    children: [
      { label: 'Solicitudes', route: '/admin/originacion/solicitudes', perm: 'credits.read' },
      { label: 'Identidad (KYC)', route: '/admin/originacion/kyc', perm: 'kyc.review' },
      { label: 'Documentación', route: '/admin/originacion/documentacion', perm: 'kyc.review' },
      { label: 'Aprobaciones', route: '/admin/originacion/aprobaciones', perm: 'credits.read' },
      { label: 'BCRA / Riesgo', route: '/admin/originacion/riesgo', perm: 'risk.read' },
      { label: 'Historial BCRA', route: '/admin/originacion/bcra-historial', perm: 'risk.read' },
      { label: 'Padrón ARCA', route: '/admin/originacion/padron-arca', perm: 'kyc.review' },
      { label: 'Webhooks Didit', route: '/admin/originacion/webhooks-didit', perm: 'kyc.review' },
    ],
  },
  {
    id: 'creditos',
    label: 'Créditos y cartera',
    icon: 'credit',
    children: [
      { label: 'Otorgados', route: '/admin/creditos/otorgados', perm: 'credits.read' },
      { label: 'Todos los cr\u00e9ditos', route: '/admin/creditos/todos', perm: 'credits.read' },
      { label: 'En revisión', route: '/admin/creditos/revision', perm: 'credits.read' },
      { label: 'Pendientes de desembolso', route: '/admin/creditos/desembolso', perm: 'payments.read' },
      { label: 'Contratos', route: '/admin/creditos/contratos', perm: 'credits.read' },
    ],
  },
  {
    id: 'cobranzas',
    label: 'Cobranzas',
    icon: 'wallet',
    children: [
      { label: 'Pagos', route: '/admin/cobranzas/pagos', perm: 'payments.read' },
      { label: 'Comprobantes', route: '/admin/cobranzas/comprobantes', perm: 'payments.read' },
      { label: 'Mora', route: '/admin/cobranzas/mora', perm: 'payments.read' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: 'users',
    children: [
      { label: 'Planilla', route: '/admin/clientes/planilla', perm: 'clients.read' },
      { label: 'Cuentas CBU', route: '/admin/clientes/cbu', perm: 'clients.read' },
    ],
  },
  { id: 'comercios', label: 'Comercios', icon: 'store', route: '/admin/comercios', perm: 'merchants.read' },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: 'chart',
    children: [
      { label: 'Panel Ejecutivo (Recharts)', route: '/admin/panel-control', perm: 'finance.read' },
      { label: 'Finanzas', route: '/admin/finanzas/resumen', perm: 'finance.read' },
      { label: 'Analíticas', route: '/admin/finanzas/analiticas', perm: 'finance.read' },
    ],
  },
  {
    id: 'contenido',
    label: 'Configuración y contenido',
    icon: 'pen',
    children: [
      { label: 'Comisiones y tasas', route: '/admin/contenido/comisiones', anyOf: CONTENT_PERMS },
      { label: 'Textos de la web', route: '/admin/contenido/textos', anyOf: CONTENT_PERMS },
      { label: 'Documentación legal', route: '/admin/contenido/legal', anyOf: CONTENT_PERMS },
      { label: 'Parámetros', route: '/admin/contenido/parametros', anyOf: CONTENT_PERMS },
      { label: 'Historial', route: '/admin/contenido/historial', anyOf: CONTENT_PERMS },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: 'sliders',
    children: [
      { label: 'Productos', route: '/admin/sistema/productos', perm: 'credits.read' },
      { label: 'Operadores', route: '/admin/sistema/operadores', perm: 'users.manage' },
      { label: 'Auditoría', route: '/admin/sistema/auditoria', perm: 'audit.read' },
      { label: 'Configuración', route: '/admin/sistema/configuracion', perm: 'users.manage' },
      { label: 'Soporte', route: '/admin/sistema/soporte', perm: 'clients.read' },
      { label: 'Mi seguridad (2FA y sesiones)', route: '/cuenta/seguridad', perm: 'clients.read' },
    ],
  },
]

/** Menú del backoffice recortado a lo que el operador puede ver (RBAC). */
export function adminMenu(perms: Set<PermissionKey>): MenuItem[] {
  const out: MenuItem[] = []
  for (const g of GROUPS) {
    if (g.children) {
      const children = g.children.filter((c) => (!c.perm || perms.has(c.perm)) && (!c.anyOf || c.anyOf.some((p) => perms.has(p)))).map(({ label, route }) => ({ label, route }))
      if (children.length) out.push({ id: g.id, label: g.label, icon: g.icon, children })
    } else if (!g.perm || perms.has(g.perm)) {
      out.push({ id: g.id, label: g.label, icon: g.icon, route: g.route })
    }
  }
  return out
}

/* ------------------------------ Celdas ------------------------------ */

export const badge = (l: string, t: Tone) => ({ l, t })

export function fmtDni(raw: string | null | undefined) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function fullName(c: Client | undefined) {
  if (!c) return 'Cliente'
  return `${c.firstName} ${c.lastName}`.trim() || c.email || 'Cliente'
}

export type ClientIndex = Map<string, Client>
export const clientIndex = (state: AdminDeskState): ClientIndex => new Map(state.clients.map((c) => [c.id, c]))

/** Cliente en dos líneas: nombre y DNI (como en la planilla del prototipo). */
export function clientCell(idx: ClientIndex, clientId: string | null | undefined) {
  const c = clientId ? idx.get(clientId) : undefined
  return { a: fullName(c), b: c?.dni ? `DNI ${fmtDni(c.dni)}` : undefined }
}

export function clientSearch(idx: ClientIndex, clientId: string | null | undefined) {
  const c = clientId ? idx.get(clientId) : undefined
  return c ? `${fullName(c)} ${c.dni} ${c.cuit} ${c.email}` : ''
}

/* Tonos por estado */
export const KYC_TONE: Record<string, Tone> = {
  verified: 'success',
  pending: 'neutral',
  in_review: 'info',
  rejected: 'danger',
  expired: 'neutral',
}
export const KYC_LABEL: Record<string, string> = {
  verified: 'Verificado',
  pending: 'Pendiente',
  in_review: 'En revisión',
  rejected: 'Rechazado',
  expired: 'Vencido',
}
export const kycBadge = (s: string) => badge(KYC_LABEL[s] ?? s, KYC_TONE[s] ?? 'neutral')

export const BUCKET_LABEL: Record<string, string> = {
  al_dia: 'Al día',
  '1_30': 'Hasta 30 d',
  '31_60': '31–60 d',
  '61_90': 'Más de 60 d',
  '90_plus': 'Más de 60 d',
}

export const bcraBadge = (v: number | null | undefined) =>
  v == null || v === 0 ? badge('Sin consultar', 'neutral') : badge(`Situación ${v}`, v === 1 ? 'success' : v === 2 ? 'warning' : 'danger')

/** Situación BCRA más reciente de cada cliente (1–5), a partir de las consultas del snapshot. */
export function bcraByClient(state: AdminDeskState) {
  const m = new Map<string, { sit: number; score: number; at: string; entities: number }>()
  for (const r of [...state.cendeu].sort((a, b) => a.consultedAt.localeCompare(b.consultedAt))) {
    const sit = r.sit5 ? 5 : r.sit4 ? 4 : r.sit3 ? 3 : r.sit2 ? 2 : r.sit1 ? 1 : 0
    m.set(r.clientId, { sit, score: r.score, at: r.consultedAt, entities: r.entities })
  }
  return m
}

