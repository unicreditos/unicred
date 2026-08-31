'use client'

import { UsersTable } from '@/components/admin/users-table'
import type { AdminUserRow } from '@/app/actions/admin'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'

export function AdminStaffDesk({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const staff = users.filter((u) => (u.role || 'customer') === 'admin')
  const merchants = users.filter((u) => u.role === 'merchant')
  const banned = staff.filter((u) => u.banned).length

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        <MetricTile label="Operadores" value={String(staff.length)} hint="Misma sesión UNICRÉDITOS" />
        <MetricTile label="Cuentas comercio" value={String(merchants.length)} hint="Titulares de adhesión, no mesa" />
        <MetricTile label="Operadores bloqueados" value={String(banned)} tone={banned ? 'warn' : 'ok'} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {staff.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No hay otras cuentas admin además de la sesión actual, o el rol no está en el perfil.
          </p>
        ) : (
          <UsersTable users={staff} currentAdminId={currentAdminId} embedded />
        )}
      </div>
    </OpsFloor>
  )
}
