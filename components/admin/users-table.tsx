'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Ban,
  FolderOpen,
  Loader2,
  Pencil,
  Search,
  ShieldOff,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import {
  deleteUserAdmin,
  setUserBanned,
  updateUserAdmin,
  type AdminUserRow,
} from '@/app/actions/admin'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { adminClientHref } from '@/lib/admin-nav'

export function UsersTable({
  users,
  currentAdminId,
  embedded = false,
}: {
  users: AdminUserRow[]
  currentAdminId: string
  embedded?: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [edit, setEdit] = useState<AdminUserRow | null>(null)
  const [del, setDel] = useState<AdminUserRow | null>(null)
  const [pending, start] = useTransition()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cuil: '',
    dni: '',
    role: 'customer' as 'customer' | 'merchant' | 'admin',
    kycStatus: 'pending',
    city: '',
    province: '',
  })

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (role !== 'all' && (u.role || 'customer') !== role) return false
      if (status === 'banned' && !u.banned) return false
      if (status === 'active' && u.banned) return false
      if (status === 'kyc_pending' && u.kycStatus === 'approved') return false
      if (!q.trim()) return true
      const s = q.toLowerCase()
      return (
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.cuil || '').includes(s) ||
        (u.dni || '').includes(s) ||
        (u.phone || '').includes(s)
      )
    })
  }, [users, q, role, status])

  const bannedCount = users.filter((u) => u.banned).length

  function openEdit(u: AdminUserRow) {
    setEdit(u)
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      cuil: u.cuil || '',
      dni: u.dni || '',
      role: ((u.role as any) || 'customer') as 'customer' | 'merchant' | 'admin',
      kycStatus: u.kycStatus || 'pending',
      city: u.city || '',
      province: u.province || '',
    })
  }

  const Floor = embedded ? 'div' : OpsFloor
  const floorClass = embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined

  return (
    <Floor className={floorClass}>
      {embedded ? null : (
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile label="Usuarios" value={users.length.toLocaleString('es-AR')} hint="Clientes, comercios y operadores" />
        <MetricTile label="Clientes" value={String(users.filter((u) => (u.role || 'customer') === 'customer').length)} />
        <MetricTile label="Comercios" value={String(users.filter((u) => u.role === 'merchant').length)} />
        <MetricTile label="Bloqueados" value={String(bannedCount)} tone={bannedCount ? 'warn' : 'ok'} hint="Sin acceso a la plataforma" />
      </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <header className="shrink-0 space-y-2 border-b px-3 py-2">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold">
            <Users className="h-3.5 w-3.5" /> Personas
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder="Nombre, email, CUIL o DNI" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v ?? 'all')}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="merchant">Comercio</SelectItem>
                <SelectItem value="admin">Operador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
              <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Habilitados</SelectItem>
                <SelectItem value="banned">Bloqueados</SelectItem>
                <SelectItem value="kyc_pending">KYC incompleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Identidad</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead className="text-right">Operar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay personas que coincidan.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id} className={u.banned ? 'opacity-70' : undefined}>
                    <TableCell>
                      <Link href={adminClientHref(u.id)} className="text-sm font-medium hover:underline">
                        {u.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.role === 'admin' ? 'Operador' : u.role === 'merchant' ? 'Comercio' : 'Cliente'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.cuil || u.dni || '—'}
                      {u.phone ? <div className="text-muted-foreground">{u.phone}</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {u.kycStatus === 'approved' ? 'Aprobado' : u.kycStatus === 'rejected' ? 'Rechazado' : u.kycStatus === 'submitted' ? 'Presentado' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {u.loansCount}
                      {u.activeLoans ? <span className="block text-[11px] text-amber-700">{u.activeLoans} vigentes</span> : null}
                    </TableCell>
                    <TableCell>
                      {u.banned ? (
                        <Badge variant="destructive">Bloqueado</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 text-emerald-800">Habilitado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8" asChild>
                          <Link href={adminClientHref(u.id)}>
                            <FolderOpen className="mr-1 h-3.5 w-3.5" /> Ficha
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(u)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={pending || u.id === currentAdminId || u.role === 'admin'}
                          onClick={() =>
                            start(async () => {
                              try {
                                await setUserBanned(u.id, !u.banned)
                                toast.success(u.banned ? 'Acceso rehabilitado' : 'Usuario bloqueado')
                                router.refresh()
                              } catch (e: any) {
                                toast.error(e?.message || 'No se pudo cambiar el acceso')
                              }
                            })
                          }
                        >
                          {u.banned ? <Unlock className="mr-1 h-3.5 w-3.5" /> : <Ban className="mr-1 h-3.5 w-3.5" />}
                          {u.banned ? 'Habilitar' : 'Bloquear'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive"
                          disabled={pending || u.id === currentAdminId || u.role === 'admin'}
                          onClick={() => setDel(u)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      </section>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar persona</DialogTitle>
            <DialogDescription>Cambios de contacto, rol y datos de perfil. Quedan en la base operativa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>CUIL</Label>
              <Input className="font-mono" value={form.cuil} onChange={(e) => setForm((f) => ({ ...f, cuil: e.target.value.replace(/\D/g, '').slice(0, 11) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>DNI</Label>
              <Input className="font-mono" value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="merchant">Comercio</SelectItem>
                  <SelectItem value="admin">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>KYC</Label>
              <Select value={form.kycStatus} onValueChange={(v) => setForm((f) => ({ ...f, kycStatus: v ?? 'pending' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="submitted">Presentado</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provincia</Label>
              <Input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button
              disabled={pending || !edit}
              onClick={() => {
                if (!edit) return
                start(async () => {
                  try {
                    await updateUserAdmin(edit.id, form)
                    toast.success('Ficha actualizada')
                    setEdit(null)
                    router.refresh()
                  } catch (e: any) {
                    toast.error(e?.message || 'No se pudo guardar')
                  }
                })
              }}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldOff className="h-4 w-4" /> Eliminar usuario</DialogTitle>
            <DialogDescription>
              Se borra la cuenta si no tiene créditos vigentes o calificados. Las solicitudes pendientes o rechazadas se limpian con la baja. Esta acción no se revierte.
            </DialogDescription>
          </DialogHeader>
          {del ? (
            <p className="text-sm">
              {del.name} · {del.email}
              {del.loansCount ? <span className="block mt-2 text-amber-700">Tiene {del.loansCount} crédito(s). Si alguno está vigente o calificado, la baja se rechaza. Los pendientes o rechazados se borran juntos.</span> : null}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={pending || !del}
              onClick={() => {
                if (!del) return
                start(async () => {
                  try {
                    await deleteUserAdmin(del.id)
                    toast.success('Usuario eliminado')
                    setDel(null)
                    router.refresh()
                  } catch (e: any) {
                    toast.error(e?.message || 'No se pudo eliminar')
                  }
                })
              }}
            >
              Confirmar baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Floor>
  )
}
