import { hasPermission, type PermissionKey } from '@/lib/rbac'
import { ensureRbacSchema } from '@/lib/db/ensure-rbac'
import type { DeskMutateAction } from '@/lib/admin-desk/mutate'
import type { AdminDeskState } from '@/lib/admin-desk/types'

/** Mapa acción desk → permiso RBAC (mismo catálogo que el panel web). */
export const DESK_ACTION_PERMISSION: Record<DeskMutateAction, PermissionKey> = {
  approveApplication: 'credits.approve',
  rejectApplication: 'credits.reject',
  cancelApplication: 'credits.reject',
  createApplication: 'credits.edit',
  reopenApplication: 'credits.edit',
  editApplication: 'credits.edit',
  decideKyc: 'kyc.review',
  markDisbursed: 'disbursements.credit',
  failDisbursement: 'disbursements.credit',
  retryDisbursement: 'disbursements.credit',
  registerPayment: 'payments.reconcile',
  matchTransfer: 'payments.reconcile',
  rejectTransfer: 'payments.reconcile',
  logCollectionContact: 'payments.reconcile',
  // No hay permiso 'support.*' en el catálogo RBAC (lib/db/ensure-rbac.ts);
  // el panel web tampoco gatea resolveSupportCase por permiso granular, solo
  // por assertRole('admin'). Se usa clients.read porque es el permiso que
  // realmente tiene el rol "Soporte" (y la mayoría de los demás roles
  // operativos, salvo Finanzas) — sin esto la acción fallaba siempre, incluso
  // para super_admin, porque 'support.write' no existe como PermissionKey.
  resolveTicket: 'clients.read',
  pauseMerchant: 'merchants.write',
  activateMerchant: 'merchants.write',
}

/**
 * Gate JWT desk: exige permiso granular. ensureRbacSchema backfillea admins
 * legacy a super_admin para no romper operadores existentes.
 */
export async function assertDeskPermission(
  userId: string,
  action: DeskMutateAction,
): Promise<void> {
  await ensureRbacSchema()
  const key = DESK_ACTION_PERMISSION[action]
  if (!(await hasPermission(userId, key))) {
    throw new Error(`No autorizado: falta permiso "${key}"`)
  }
}

/**
 * Mapa sección del snapshot → permiso RBAC requerido para verla. Mismo
 * criterio que ya aplica app/actions/admin.ts vía requirePermission() en el
 * panel web (clients.read, payments.read, finance.read, audit.read, etc.):
 * el desk JWT no debe devolver más de lo que el operador vería ahí.
 * Las secciones no listadas (products, contracts, tickets, config, series)
 * ya son visibles a cualquier admin en el panel web, sin permiso puntual.
 */
const DESK_SECTION_PERMISSION: Partial<Record<keyof AdminDeskState, PermissionKey>> = {
  clients: 'clients.read',
  kyc: 'kyc.review',
  merchants: 'merchants.read',
  applications: 'credits.read',
  credits: 'credits.read',
  approvals: 'credits.read',
  payments: 'payments.read',
  disbursements: 'payments.read',
  receipts: 'payments.read',
  collections: 'payments.read',
  accounts: 'finance.read',
  ledger: 'finance.read',
  cendeu: 'risk.read',
  bcra: 'risk.read',
  audit: 'audit.read',
  operators: 'users.manage',
}

/**
 * Recorta el snapshot del desk a las secciones que el operador puede ver
 * según su rol RBAC real (no solo profile.role === 'admin'). Vacía el
 * arreglo en vez de omitir la clave para no romper el tipo que espera
 * unicreditos-admin.
 */
export function filterDeskStateByPermissions(
  state: AdminDeskState,
  perms: Set<PermissionKey>,
): AdminDeskState {
  const filtered = { ...state }
  for (const [section, permission] of Object.entries(DESK_SECTION_PERMISSION) as Array<
    [keyof AdminDeskState, PermissionKey]
  >) {
    if (!perms.has(permission)) {
      ;(filtered[section] as unknown[]) = []
    }
  }
  return filtered
}
