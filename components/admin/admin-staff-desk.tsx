'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UsersTable } from '@/components/admin/users-table'
import type { AdminUserRow } from '@/app/actions/admin'
import { assignAdminRole } from '@/app/actions/staff-roles'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { Badge } from '@/components/ui/badge'

type RoleRow = {
  id: string
  key: string
  label: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}

export function AdminStaffDesk({
  users,
  currentAdminId,
  canManageUsers,
  roles,
}: {
  users: AdminUserRow[]
  currentAdminId: string
  canManageUsers: boolean
  roles: RoleRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const staff = users.filter((u) => (u.role || 'customer') === 'admin')
  const merchants = users.filter((u) => u.role === 'merchant')
  const banned = staff.filter((u) => u.banned).length
  const roleById = new Map(roles.map((r) => [r.id, r]))
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  function changeRole(userId: string, roleId: string) {
    setPendingUserId(userId)
    startTransition(async () => {
      try {
        await assignAdminRole(userId, roleId)
        toast.success('Rol actualizado')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol')
      } finally {
        setPendingUserId(null)
      }
    })
  }

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        <MetricTile label="Operadores" value={String(staff.length)} hint="Misma sesión UNICRÉDITOS" />
        <MetricTile label="Cuentas comercio" value={String(merchants.length)} hint="Titulares de adhesión, no mesa" />
        <MetricTile label="Operadores bloqueados" value={String(banned)} tone={banned ? 'warn' : 'ok'} />
      </div>

      {staff.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No hay otras cuentas admin además de la sesión actual, o el rol no está en el perfil.
        </p>
      ) : roles.length === 0 ? (
        <UsersTable users={staff} currentAdminId={currentAdminId} embedded />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Operador</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Rol asignado</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const currentRole = u.adminRoleId ? roleById.get(u.adminRoleId) : null
                return (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{u.name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.banned ? (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Bloqueado</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Habilitado</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canManageUsers ? (
                        <select
                          className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                          value={u.adminRoleId ?? ''}
                          disabled={isPending && pendingUserId === u.id}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          aria-label={`Rol de ${u.email}`}
                        >
                          <option value="" disabled>
                            Sin rol asignado
                          </option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : currentRole ? (
                        <Badge variant="outline">{currentRole.label}</Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sin rol asignado</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {roles.length > 0 ? (
        <div className="shrink-0 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <h2 className="mb-2 text-[13px] font-semibold text-brand-navy-900">Roles y permisos</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <div key={r.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold">{r.label}</p>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{r.permissions.length} permisos</span>
                </div>
                {r.description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </OpsFloor>
  )
}
