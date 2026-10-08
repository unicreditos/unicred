'use client'

import {
  SectionCard,
} from '@/components/unicred/dashboard-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatCBU,
  formatCVU,
  displayAlias,
  normalizeBankAlias,
} from '@/lib/finance'

import {
  profile,
  bankAccount,
} from '@/lib/db/schema'
import { useState } from 'react'
import {
  Landmark,
  Star,
  Trash2,
  Check,
  Clock,
  Globe2,
  Pencil,
  Loader2,
} from 'lucide-react'

type Profile = typeof profile.$inferSelect
type BankAccount = typeof bankAccount.$inferSelect


export function BancosPanel({
  accounts,
  profile,
  defaultHolderName,
  isPending,
  onLookupCreate,
  onUpdate,
  onSetPrimary,
  onDelete,
  onValidate,
}: {
  accounts: BankAccount[]
  profile: Profile | null
  defaultHolderName?: string
  isPending: boolean
  onLookupCreate: (identifier: string, setAsPrimary: boolean) => void
  onUpdate: (
    id: string,
    v: {
      accountType: 'cbu' | 'cvu' | 'alias' | 'cci'
      bankName: string
      cbu?: string
      cvu?: string
      alias?: string
      accountNumber?: string
      holderName: string
      holderCuil: string
    },
  ) => void
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => void
  onValidate: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [primary, setPrimary] = useState(accounts.length === 0)
  const [preview, setPreview] = useState<{
    bankName: string
    holderName: string
    holderCuil: string
    cbu?: string
    cvu?: string
    alias?: string
    accountType: string
  } | null>(null)

  function resetForm() {
    setEditingId(null)
    setIdentifier('')
    setPreview(null)
    setPrimary(accounts.length === 0)
  }

  function startEdit(a: BankAccount) {
    setEditingId(a.id)
    setIdentifier(a.cbu || a.cvu || a.alias || '')
    setPreview({
      bankName: a.bankName,
      holderName: a.holderName,
      holderCuil: a.holderCuil,
      cbu: a.cbu || undefined,
      cvu: a.cvu || undefined,
      alias: a.alias || undefined,
      accountType: a.accountType,
    })
    setPrimary(!!a.isPrimary)
  }

  const canSubmit = identifier.trim().length >= 6

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <SectionCard
        title="Mis cuentas de desembolso"
        description="Las cuentas se usarán para acreditar tus préstamos y cobrar reintegros."
        icon={<Landmark className="h-4 w-4" />}
        className="lg:col-span-3"
      >
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                No tenés cuentas bancarias cargadas
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Ingresá tu CBU, CVU o alias. Al validar, consultamos la red y completamos
                titular, entidad y CUIL automáticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                    >
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{a.bankName}</p>
                        <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                          {a.accountType}
                        </Badge>
                        {a.isPrimary && (
                          <Badge className="gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
                            <Star className="h-3 w-3 fill-white" /> Principal
                          </Badge>
                        )}
                        {a.isVerified ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-300/60 text-emerald-700 dark:text-emerald-400"
                          >
                            <Check className="h-3 w-3" /> Verificada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-300/60 text-amber-700 dark:text-amber-400"
                          >
                            <Clock className="h-3 w-3" /> Pendiente verif.
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Titular: {a.holderName} · CUIL {a.holderCuil}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-xs">
                        {a.cbu && (
                          <span>
                            CBU: <span className="font-semibold">{formatCBU(a.cbu)}</span>
                          </span>
                        )}
                        {a.cvu && (
                          <span>
                            CVU: <span className="font-semibold">{formatCVU(a.cvu)}</span>
                          </span>
                        )}
                        {a.alias && (
                          <span>
                            ALIAS: <span className="font-semibold">{displayAlias(a.alias)}</span>
                          </span>
                        )}
                      </div>
                      {a.extractedProfile ? (
                        <div className="mt-2 grid gap-1 rounded-md bg-muted/60 px-2 py-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                          <span>
                            Entidad:{' '}
                            <strong className="text-foreground">
                              {(a.extractedProfile as any).entidad || a.bankName}
                            </strong>
                          </span>
                          <span>Código: {(a.extractedProfile as any).codigoEntidad || a.bankCode || '—'}</span>
                          <span>Esquema: {a.scheme || (a.extractedProfile as any).scheme || a.accountType}</span>
                          <span>Red: {a.networkStatus || (a.extractedProfile as any).estado || '—'}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!a.isVerified && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1"
                        disabled={isPending || !(a.cbu || a.cvu || a.alias)}
                        onClick={() => onValidate(a.id)}
                      >
                        <Globe2 className="h-3.5 w-3.5" /> Validar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={isPending}
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    {!a.isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => onSetPrimary(a.id)}
                      >
                        <Star className="h-3.5 w-3.5" /> Principal
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => onDelete(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </SectionCard>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Editar cuenta' : 'Agregar cuenta'}</CardTitle>
          <CardDescription>
            Solo CBU, CVU (22 dígitos) o alias. Al validar, completamos y guardamos los datos de la red.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bank-identifier">CBU, CVU o alias</Label>
            <Input
              id="bank-identifier"
              value={identifier}
              onChange={(e) => {
                const raw = e.target.value.trim()
                const digits = raw.replace(/\D/g, '')
                if (digits.length >= 10 && /^[\d\s.-]+$/.test(raw)) {
                  setIdentifier(digits.slice(0, 22))
                } else {
                  setIdentifier(normalizeBankAlias(raw) || raw.replace(/^@+/, '').toLowerCase())
                }
                setPreview(null)
              }}
              placeholder="Ej: 01700991… o mi.alias.mp"
              className="font-mono tracking-wide"
              autoComplete="off"
              inputMode="text"
            />
            <p className="text-[11px] text-muted-foreground">
              Pegá el CBU/CVU completo o el alias sin @. El sistema detecta el tipo solo.
            </p>
          </div>

          {preview ? (
            <div className="space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Datos de la cuenta</p>
              <div className="grid gap-1.5 text-xs text-foreground">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Entidad</span>
                  <span className="font-semibold text-foreground">{preview.bankName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Titular</span>
                  <span className="font-semibold text-foreground">{preview.holderName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">CUIL</span>
                  <span className="font-mono font-semibold text-foreground">{preview.holderCuil}</span>
                </div>
                {preview.cbu ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">CBU</span>
                    <span className="font-mono text-foreground">{formatCBU(preview.cbu)}</span>
                  </div>
                ) : null}
                {preview.cvu ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">CVU</span>
                    <span className="font-mono text-foreground">{formatCVU(preview.cvu)}</span>
                  </div>
                ) : null}
                {preview.alias ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Alias</span>
                    <span className="font-mono text-foreground">{displayAlias(preview.alias)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!editingId ? (
            <label className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span>
                Establecer como <span className="font-semibold">cuenta principal</span> para acreditaciones.
              </span>
            </label>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2 border-t bg-muted/20">
          {editingId ? (
            <>
              <Button type="button" variant="outline" className="w-full" disabled={isPending} onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                className="w-full gap-1.5"
                disabled={isPending || !canSubmit}
                onClick={() => {
                  const digits = identifier.replace(/\D/g, '')
                  const isDigits = digits.length === 22
                  const alias = normalizeBankAlias(identifier)
                  const accountType = isDigits ? (digits.startsWith('000') ? 'cvu' : 'cbu') : 'alias'
                  onUpdate(editingId, {
                    accountType,
                    bankName: preview?.bankName || 'Cuenta bancaria',
                    cbu: accountType === 'cbu' ? digits : undefined,
                    cvu: accountType === 'cvu' ? digits : undefined,
                    alias: accountType === 'alias' ? alias : undefined,
                    holderName:
                      preview?.holderName ||
                      (profile as any)?.fullName ||
                      defaultHolderName ||
                      '',
                    holderCuil: preview?.holderCuil || profile?.cuil || '',
                  })
                  resetForm()
                }}
              >
                Guardar
              </Button>
            </>
          ) : (
            <Button
              className="w-full gap-1.5"
              disabled={isPending || !canSubmit}
              onClick={() => onLookupCreate(identifier.trim(), primary)}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando…
                </>
              ) : (
                <>
                  <Globe2 className="h-4 w-4" /> Validar y agregar
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

