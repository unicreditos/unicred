'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Search,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Building2,
  UserCircle,
  CreditCard,
  Pencil,
  Ban,
} from 'lucide-react'
import { displayAlias, normalizeBankAlias } from '@/lib/finance'
import {
  verifyBankAccountArgenapi,
  setBankAccountVerificationManual,
  updateBankAccountAdmin,
  deactivateBankAccountAdmin,
} from '@/app/actions/admin'

type BankAccountRow = {
  id: string
  userId: string
  accountType: string | null
  bankName: string | null
  cbu: string | null
  cvu: string | null
  alias: string | null
  holderName: string | null
  holderCuil: string | null
  isPrimary: boolean | null
  isVerified: boolean | null
  isActive: boolean | null
  bankCode: string | null
  branch: string | null
  scheme: string | null
  currency: string | null
  networkStatus: string | null
  networkBlocked: boolean | null
  extractedProfile: any
  extractedAt: Date | null
  verificationData: any
  verifiedAt: Date | null
  verifiedBy: string | null
  createdAt: Date | null
  updatedAt: Date | null
  userEmail: string
  userName: string | null
  userCuil: string | null
  userRole: string | null
}

function VerificationBadge({ a }: { a: BankAccountRow }) {
  if (a.isVerified) {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-600 flex items-center gap-1 w-fit">
        <ShieldCheck className="w-3.5 h-3.5" />
        Verificada
      </Badge>
    )
  }
  const hadAttempt = !!a.verificationData?.best || !!a.verificationData?.verifications
  if (hadAttempt) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
        <ShieldX className="w-3.5 h-3.5" />
        Rechazada
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
      <ShieldAlert className="w-3.5 h-3.5" />
      Sin validar
    </Badge>
  )
}

export function BankAccountsTable({ accounts }: { accounts: BankAccountRow[] }) {
  const router = useRouter()
  const [isPendingVerify, startVerify] = useTransition()
  const [isPendingManual, startManual] = useTransition()
  const [search, setSearch] = useState('')
  const [verifyLoadingId, setVerifyLoadingId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState<BankAccountRow | null>(null)
  const [manualOpen, setManualOpen] = useState<BankAccountRow | null>(null)
  const [manualNote, setManualNote] = useState('')
  const [manualApproved, setManualApproved] = useState<boolean>(true)
  const [editOpen, setEditOpen] = useState<BankAccountRow | null>(null)
  const [isPendingEdit, startEdit] = useTransition()
  const [editForm, setEditForm] = useState({
    bankName: '',
    accountType: 'alias' as 'cbu' | 'cvu' | 'alias' | 'cci',
    alias: '',
    cbu: '',
    cvu: '',
    holderName: '',
    holderCuil: '',
    isPrimary: false,
  })

  const filtered = accounts.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.userEmail.toLowerCase().includes(q) ||
      (a.userName || '').toLowerCase().includes(q) ||
      (a.cbu || '').includes(q) ||
      (a.cvu || '').includes(q) ||
      (a.alias || '').toLowerCase().includes(q) ||
      (a.bankName || '').toLowerCase().includes(q) ||
      (a.accountType || '').toLowerCase().includes(q)
    )
  })

  const stats = {
    total: accounts.length,
    verified: accounts.filter((a) => !!a.isVerified).length,
    notVerified: accounts.filter((a) => !a.isVerified).length,
    withData: accounts.filter((a) => !!a.verificationData).length,
  }

  function handleArgenapi(id: string) {
    setVerifyLoadingId(id)
    startVerify(async () => {
      try {
        const res = await verifyBankAccountArgenapi(id)
        if (res.ok) {
          toast.success(res.message || 'Validación exitosa', {
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          })
        } else {
          toast.warning(res.message || 'No se pudo validar la cuenta')
        }
      } catch (e: any) {
        toast.error(e?.message || 'Error al validar')
      } finally {
        setVerifyLoadingId(null)
        router.refresh()
      }
    })
  }

  function openEdit(a: BankAccountRow) {
    setEditOpen(a)
    setEditForm({
      bankName: a.bankName || '',
      accountType: ((a.accountType as any) || 'alias') as 'cbu' | 'cvu' | 'alias' | 'cci',
      alias: normalizeBankAlias(a.alias || ''),
      cbu: a.cbu || '',
      cvu: a.cvu || '',
      holderName: a.holderName || a.userName || '',
      holderCuil: a.holderCuil || a.userCuil || '',
      isPrimary: !!a.isPrimary,
    })
  }

  function handleManualConfirm() {
    if (!manualOpen) return
    const id = manualOpen.id
    startManual(async () => {
      try {
        await setBankAccountVerificationManual(id, manualApproved, manualNote || undefined)
        toast.success(
          manualApproved ? 'Cuenta marcada como VERIFICADA manualmente' : 'Cuenta marcada como RECHAZADA manualmente',
          { icon: <ShieldCheck className="w-4 h-4 text-emerald-600" /> },
        )
        setManualOpen(null)
        setManualNote('')
        router.refresh()
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Cuentas Bancarias · CVU/CBU/ALIAS
              <Badge variant="outline" className="ml-2">
                {stats.total} totales
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Editar alias, CBU/CVU o titular. Validar con ArgenAPI o aprobar/rechazar de forma manual.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Badge className="bg-emerald-500 hover:bg-emerald-600">{stats.verified} Verificadas</Badge>
            <Badge variant="secondary">{stats.notVerified} Pendientes</Badge>
            <Badge variant="outline">{stats.withData} Con datos ArgenAPI</Badge>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Buscar por cliente, email, CBU/CVU/alias, banco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 border-t">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>CBU / CVU / Alias</TableHead>
                <TableHead>Verificación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No hay cuentas bancarias que coincidan.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                        <UserCircle className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-sm truncate">{a.userName || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.userEmail}</div>
                        {a.userCuil && (
                          <div className="text-xs text-muted-foreground">
                            CUIL: {a.userCuil}
                            {a.userRole && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                                {a.userRole}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{a.bankName || '—'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.accountType || 'Cuenta'}
                        {a.isPrimary && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                            Primaria
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 mt-1">
                        Creada: {a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-AR') : '—'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 font-mono text-xs">
                      {a.cbu && (
                        <div className="bg-muted rounded px-2 py-1 break-all select-all">
                          <span className="text-muted-foreground not-italic font-sans mr-1">CBU</span>
                          {a.cbu}
                        </div>
                      )}
                      {a.cvu && a.cvu !== a.cbu && (
                        <div className="bg-muted rounded px-2 py-1 break-all select-all">
                          <span className="text-muted-foreground not-italic font-sans mr-1">CVU</span>
                          {a.cvu}
                        </div>
                      )}
                      {a.alias && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded px-2 py-1 break-all select-all">
                          {displayAlias(a.alias)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <VerificationBadge a={a} />
                      {a.verifiedAt && (
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(a.verifiedAt).toLocaleString('es-AR')}
                        </div>
                      )}
                      {a.verificationData?.best?.data && (
                        <div className="text-xs space-y-0.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-md px-2 py-1.5 border border-emerald-200 dark:border-emerald-900">
                          <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {a.verificationData.best.data.entidad || a.verificationData.best.data.banco || 'Entidad validada'}
                          </div>
                          <div className="text-emerald-700/90 dark:text-emerald-300/90 truncate">
                            {a.verificationData.best.data.titular || 'Titular confirmado'}
                          </div>
                          {a.verificationData.best.data.cuil && (
                            <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                              CUIL: {a.verificationData.best.data.cuil}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(a)}>
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPendingVerify && verifyLoadingId === a.id}
                        onClick={() => handleArgenapi(a.id)}
                      >
                        {verifyLoadingId === a.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Validar
                      </Button>
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => setDetailOpen(a)}>
                        <Eye className="w-4 h-4" />
                        Detalle
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                          setManualOpen(a)
                          setManualApproved(true)
                          setManualNote('')
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Validación
                      </Button>
                      {a.isActive !== false ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          disabled={isPendingEdit}
                          onClick={() =>
                            startEdit(async () => {
                              try {
                                await deactivateBankAccountAdmin(a.id)
                                toast.success('Cuenta desactivada')
                                router.refresh()
                              } catch (e: any) {
                                toast.error(e?.message || 'No se pudo desactivar')
                              }
                            })
                          }
                        >
                          <Ban className="w-4 h-4" />
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={isPendingEdit}
                          onClick={() =>
                            startEdit(async () => {
                              try {
                                await updateBankAccountAdmin(a.id, { isActive: true })
                                toast.success('Cuenta reactivada')
                                router.refresh()
                              } catch (e: any) {
                                toast.error(e?.message || 'No se pudo reactivar')
                              }
                            })
                          }
                        >
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!detailOpen} onOpenChange={(o: boolean) => !o && setDetailOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              Detalle completo de cuenta bancaria
            </DialogTitle>
            <DialogDescription>
              Todos los datos persisten en la DB de UNICRÉDITOS y son 100% auditables.
            </DialogDescription>
          </DialogHeader>
          {detailOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <div className="text-sm font-medium mt-1">{detailOpen.userName || '—'}</div>
                  <div className="text-xs text-muted-foreground">{detailOpen.userEmail}</div>
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <div className="mt-1"><VerificationBadge a={detailOpen} /></div>
                </div>
                <div>
                  <Label className="text-xs">Banco</Label>
                  <div className="text-sm font-medium mt-1">{detailOpen.bankName || '—'}</div>
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <div className="text-sm font-medium mt-1">{detailOpen.accountType || '—'}</div>
                </div>
                <div className="col-span-2 font-mono text-xs space-y-1">
                  {detailOpen.cbu && (
                    <div className="bg-muted rounded px-2 py-1 break-all select-all">
                      <span className="text-muted-foreground not-italic font-sans mr-1">CBU</span>{detailOpen.cbu}
                    </div>
                  )}
                  {detailOpen.cvu && detailOpen.cvu !== detailOpen.cbu && (
                    <div className="bg-muted rounded px-2 py-1 break-all select-all">
                      <span className="text-muted-foreground not-italic font-sans mr-1">CVU</span>{detailOpen.cvu}
                    </div>
                  )}
                  {detailOpen.alias && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded px-2 py-1 break-all select-all">
                      {displayAlias(detailOpen.alias)}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Ficha extraída (guardada en base)</Label>
                <pre className="mt-2 text-[11px] bg-black/90 text-emerald-300 rounded-lg p-4 max-h-[30vh] overflow-auto whitespace-pre-wrap break-all leading-relaxed">
{detailOpen.extractedProfile
  ? JSON.stringify(detailOpen.extractedProfile, null, 2)
  : '// Todavía no hay extracción. Usá Validar.'}
                </pre>
              </div>

              <div>
                <Label>VerificationData JSON (DB UNICRÉDITOS)</Label>
                <pre className="mt-2 text-[11px] bg-black/90 text-emerald-300 rounded-lg p-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-all leading-relaxed">
{detailOpen.verificationData
  ? JSON.stringify(detailOpen.verificationData, null, 2)
  : '// Sin datos de validación previos'}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(null)}>Cerrar</Button>
            {detailOpen ? (
              <Button
                onClick={() => {
                  openEdit(detailOpen)
                  setDetailOpen(null)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar ficha
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manualOpen} onOpenChange={(o: boolean) => !o && setManualOpen(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Validación manual
            </DialogTitle>
            <DialogDescription>
              Aprueba o rechaza la verificación. Para cambiar alias, CBU, CVU o titular usá Editar ficha.
            </DialogDescription>
          </DialogHeader>
          {manualOpen && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium">{manualOpen.userName || '—'}</div>
                <div className="text-xs text-muted-foreground">{manualOpen.userEmail}</div>
                <div className="font-mono text-xs mt-2 space-y-1">
                  {manualOpen.cbu && (
                    <div><span className="text-muted-foreground not-italic font-sans mr-1">CBU</span>{manualOpen.cbu}</div>
                  )}
                  {manualOpen.cvu && manualOpen.cvu !== manualOpen.cbu && (
                    <div><span className="text-muted-foreground not-italic font-sans mr-1">CVU</span>{manualOpen.cvu}</div>
                  )}
                  {manualOpen.alias && <div>{displayAlias(manualOpen.alias)}</div>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    openEdit(manualOpen)
                    setManualOpen(null)
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar alias, CBU o titular
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={manualApproved ? 'default' : 'outline'}
                  className={manualApproved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => setManualApproved(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Marcar VERIFICADA
                </Button>
                <Button
                  type="button"
                  variant={!manualApproved ? 'destructive' : 'outline'}
                  onClick={() => setManualApproved(false)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Marcar RECHAZADA
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Nota de auditoría (opcional)</Label>
                <Textarea
                  rows={4}
                  placeholder="Motivo por el cual se aprueba/rechaza manualmente esta cuenta..."
                  value={manualNote}
                  onChange={(e: any) => setManualNote(e.target.value as string)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualOpen(null)}>Cancelar</Button>
            <Button
              type="button"
              disabled={isPendingManual}
              onClick={handleManualConfirm}
              className={manualApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {isPendingManual ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar gestión manual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOpen} onOpenChange={(o: boolean) => !o && setEditOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Editar cuenta de cobro
            </DialogTitle>
            <DialogDescription>
              Corregí alias, CBU/CVU o titular. Si cambia el identificador, hay que volver a validar.
            </DialogDescription>
          </DialogHeader>
          {editOpen && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-md bg-muted px-3 py-2 text-sm">
                <p className="font-medium">{editOpen.userName}</p>
                <p className="text-xs text-muted-foreground">{editOpen.userEmail}</p>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Banco / entidad</Label>
                <Input value={editForm.bankName} onChange={(e) => setEditForm((f) => ({ ...f, bankName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={editForm.accountType}
                  onChange={(e) => setEditForm((f) => ({ ...f, accountType: e.target.value as any }))}
                >
                  <option value="cbu">CBU</option>
                  <option value="cvu">CVU</option>
                  <option value="alias">Alias</option>
                  <option value="cci">CCI</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Alias (sin @)</Label>
                <Input
                  className="lowercase"
                  value={editForm.alias}
                  onChange={(e) => setEditForm((f) => ({ ...f, alias: normalizeBankAlias(e.target.value) }))}
                  placeholder="emprenor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CBU</Label>
                <Input className="font-mono" value={editForm.cbu} onChange={(e) => setEditForm((f) => ({ ...f, cbu: e.target.value.replace(/\D/g, '').slice(0, 22) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>CVU</Label>
                <Input className="font-mono" value={editForm.cvu} onChange={(e) => setEditForm((f) => ({ ...f, cvu: e.target.value.replace(/\D/g, '').slice(0, 22) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Titular</Label>
                <Input value={editForm.holderName} onChange={(e) => setEditForm((f) => ({ ...f, holderName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>CUIL titular</Label>
                <Input className="font-mono" value={editForm.holderCuil} onChange={(e) => setEditForm((f) => ({ ...f, holderCuil: e.target.value.replace(/\D/g, '').slice(0, 11) }))} />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isPrimary}
                  onChange={(e) => setEditForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                />
                Cuenta principal de desembolso
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(null)}>Cancelar</Button>
            <Button
              disabled={isPendingEdit || !editOpen}
              onClick={() => {
                if (!editOpen) return
                startEdit(async () => {
                  try {
                    const r = await updateBankAccountAdmin(editOpen.id, editForm)
                    toast.success(r.needsRevalidation ? 'Guardado. Volvé a validar el alias/CBU.' : 'Cuenta actualizada')
                    setEditOpen(null)
                    router.refresh()
                  } catch (e: any) {
                    toast.error(e?.message || 'No se pudo guardar')
                  }
                })
              }}
            >
              {isPendingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
