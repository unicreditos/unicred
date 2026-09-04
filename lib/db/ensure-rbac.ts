import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { adminPermission, adminRole, adminRolePermission } from '@/lib/db/schema'

/**
 * Catálogo fijo de permisos verificables server-side. Cambiar esto es un
 * cambio de código, no una acción de UI: agregar una fila acá y usar
 * requirePermission() donde corresponda.
 */
export const PERMISSIONS = [
  { key: 'clients.read', label: 'Ver clientes', category: 'Clientes' },
  { key: 'clients.write', label: 'Editar clientes', category: 'Clientes' },
  { key: 'credits.read', label: 'Ver créditos', category: 'Créditos' },
  { key: 'credits.approve', label: 'Aprobar créditos', category: 'Créditos' },
  { key: 'credits.reject', label: 'Rechazar créditos', category: 'Créditos' },
  { key: 'credits.edit', label: 'Editar créditos manualmente', category: 'Créditos' },
  { key: 'disbursements.credit', label: 'Acreditar desembolsos', category: 'Créditos' },
  { key: 'payments.read', label: 'Ver pagos', category: 'Pagos' },
  { key: 'payments.reconcile', label: 'Conciliar transferencias', category: 'Pagos' },
  { key: 'merchants.read', label: 'Ver comercios', category: 'Comercios' },
  { key: 'merchants.write', label: 'Aprobar / dar de baja comercios', category: 'Comercios' },
  { key: 'kyc.review', label: 'Revisar identidad (KYC)', category: 'Riesgo' },
  { key: 'risk.read', label: 'Ver riesgo y score', category: 'Riesgo' },
  { key: 'risk.score.write', label: 'Ajustar score manualmente', category: 'Riesgo' },
  { key: 'risk.rules.write', label: 'Versionar reglas de underwriting', category: 'Riesgo' },
  { key: 'finance.read', label: 'Ver finanzas', category: 'Finanzas' },
  { key: 'reports.export', label: 'Exportar reportes', category: 'Reportes' },
  { key: 'users.manage', label: 'Gestionar operadores y roles', category: 'Sistema' },
  { key: 'config.write', label: 'Editar productos y configuración', category: 'Sistema' },
  { key: 'audit.read', label: 'Ver auditoría', category: 'Sistema' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

const ALL_KEYS = PERMISSIONS.map((p) => p.key)
const READ_ONLY_KEYS = PERMISSIONS.filter((p) => p.key.endsWith('.read')).map((p) => p.key)

/**
 * Roles por defecto. `isSystem` evita que se borren desde la UI; se puede
 * crear roles nuevos además de estos. super_admin siempre tiene todos los
 * permisos (incluso los que se agreguen después) por eso se resuelve
 * dinámicamente en el seed, no como lista fija.
 */
export const DEFAULT_ROLES: Array<{ key: string; label: string; description: string; permissions: readonly string[] }> = [
  { key: 'super_admin', label: 'Super Admin', description: 'Acceso total. Reservado para dirección técnica.', permissions: ALL_KEYS },
  { key: 'director', label: 'Director', description: 'Visión completa y autoridad de aprobación.', permissions: [...ALL_KEYS.filter((k) => k !== 'users.manage')] },
  { key: 'gerente', label: 'Gerente', description: 'Operación diaria sin gestión de usuarios ni configuración.', permissions: ALL_KEYS.filter((k) => !['users.manage', 'config.write'].includes(k)) },
  { key: 'creditos', label: 'Mesa de Créditos', description: 'Evalúa y decide solicitudes.', permissions: ['clients.read', 'credits.read', 'credits.approve', 'credits.reject', 'credits.edit', 'kyc.review', 'risk.read'] },
  { key: 'riesgo', label: 'Riesgo', description: 'Score, KYC y variables de riesgo.', permissions: ['clients.read', 'credits.read', 'risk.read', 'risk.score.write', 'risk.rules.write', 'kyc.review'] },
  { key: 'finanzas', label: 'Finanzas', description: 'Tesorería, desembolsos y conciliación.', permissions: ['finance.read', 'payments.read', 'payments.reconcile', 'disbursements.credit', 'reports.export'] },
  { key: 'cobranzas', label: 'Cobranzas', description: 'Gestión de mora y cobros.', permissions: ['clients.read', 'credits.read', 'payments.read', 'payments.reconcile'] },
  { key: 'comercial', label: 'Comercial', description: 'Alta y gestión de comercios adheridos.', permissions: ['merchants.read', 'merchants.write', 'clients.read'] },
  { key: 'soporte', label: 'Soporte', description: 'Atención al cliente, solo lectura.', permissions: ['clients.read', 'credits.read', 'payments.read'] },
  { key: 'auditor', label: 'Auditor', description: 'Lectura total, sin capacidad de modificar nada.', permissions: [...READ_ONLY_KEYS, 'audit.read'] },
]

let ensured = false

/** Alta one-shot: no hay carpeta de migraciones Drizzle en este repo. */
export async function ensureRbacSchema() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_role (
      id text PRIMARY KEY,
      key text NOT NULL UNIQUE,
      label text NOT NULL,
      description text,
      "isSystem" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_permission (
      id text PRIMARY KEY,
      key text NOT NULL UNIQUE,
      label text NOT NULL,
      category text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_role_permission (
      id text PRIMARY KEY,
      "roleId" text NOT NULL REFERENCES admin_role(id) ON DELETE CASCADE,
      "permissionId" text NOT NULL REFERENCES admin_permission(id) ON DELETE CASCADE
    )
  `)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_role_permission_unique ON admin_role_permission ("roleId", "permissionId")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS admin_role_permission_role_idx ON admin_role_permission ("roleId")`)
  await db.execute(sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS "adminRoleId" text REFERENCES admin_role(id) ON DELETE SET NULL`)

  await seedPermissions()
  await seedRoles()
  await backfillExistingAdmins()

  ensured = true
}

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await db
      .insert(adminPermission)
      .values({ id: `perm_${p.key.replace(/\./g, '_')}`, key: p.key, label: p.label, category: p.category })
      .onConflictDoNothing({ target: adminPermission.key })
  }
}

async function seedRoles() {
  const permRows = await db.select().from(adminPermission)
  const permIdByKey = new Map(permRows.map((p) => [p.key, p.id]))

  for (const r of DEFAULT_ROLES) {
    const roleId = `role_${r.key}`
    await db
      .insert(adminRole)
      .values({ id: roleId, key: r.key, label: r.label, description: r.description, isSystem: true })
      .onConflictDoUpdate({
        target: adminRole.key,
        set: { label: r.label, description: r.description, isSystem: true },
      })

    for (const permKey of r.permissions) {
      const permissionId = permIdByKey.get(permKey)
      if (!permissionId) continue
      await db
        .insert(adminRolePermission)
        .values({ id: `${roleId}__${permissionId}`, roleId, permissionId })
        .onConflictDoNothing({ target: [adminRolePermission.roleId, adminRolePermission.permissionId] })
    }
  }
}

/** Admins que ya existían antes de RBAC quedan como super_admin: nadie pierde acceso al migrar. */
async function backfillExistingAdmins() {
  await db.execute(sql`
    UPDATE profile
    SET "adminRoleId" = 'role_super_admin'
    WHERE role = 'admin' AND "adminRoleId" IS NULL
  `)
}
