'use client'

import { requestProfileChange } from '@/app/actions/account'
import { grantBcraConsent, updateProfile } from '@/app/actions/loans'
import { GeoArFields, type GeoValue } from '@/components/geo-ar-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { BRAND } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { profile } from '@/lib/db/schema'
import { AccountAvatar } from '@/components/unicred/account-avatar'
import { CheckCircle2, Circle, Loader2, Lock, Send, ShieldCheck } from 'lucide-react'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Profile = typeof profile.$inferSelect

const SITUACIONES_LABORALES = [
  'Relación de dependencia',
  'Monotributista',
  'Autónomo',
  'Profesional independiente',
  'Jubilado / Pensionado',
  'Desempleado',
  'Otro',
]

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function formatCuil(raw: string) {
  const d = digits(raw).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

function incomeSeed(value: Profile['monthlyIncome'] | undefined) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(Math.round(n))
}

export function KYCProfileForm({
  initialProfile,
  user,
  diditApproved = false,
  onOpenDidit,
}: {
  initialProfile: Profile | null
  user?: { name?: string | null; email?: string | null; image?: string | null }
  diditApproved?: boolean
  onOpenDidit?: () => void
}) {
  const router = useRouter()
  const [consentPending, startConsent] = useTransition()
  const [requestPending, startRequest] = useTransition()
  const [consentError, setConsentError] = useState<string | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestFields, setRequestFields] = useState('')
  const [requestMsg, setRequestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const identityLocked =
    initialProfile?.kycStatus === 'approved' ||
    initialProfile?.kycStatus === 'verified' ||
    diditApproved

  const [cuil, setCuil] = useState(formatCuil(initialProfile?.cuil ?? ''))
  const [dni, setDni] = useState(digits(initialProfile?.dni ?? '').slice(0, 8))
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate ?? '')
  const [phone, setPhone] = useState(initialProfile?.phone ?? '')
  const [address, setAddress] = useState(initialProfile?.address ?? '')
  const [monthlyIncome, setMonthlyIncome] = useState(incomeSeed(initialProfile?.monthlyIncome))
  const [geo, setGeo] = useState<GeoValue>({
    province: initialProfile?.province ?? '',
    department: initialProfile?.department ?? '',
    city: initialProfile?.city ?? '',
    postalCode: initialProfile?.postalCode ?? '',
  })
  const [employmentStatus, setEmploymentStatus] = useState(initialProfile?.employmentStatus ?? '')

  const profileStamp = [
    initialProfile?.updatedAt ? String(initialProfile.updatedAt) : '',
    initialProfile?.cuil ?? '',
    initialProfile?.kycStatus ?? '',
    initialProfile?.bcraConsentAt ? String(initialProfile.bcraConsentAt) : '',
  ].join('|')

  // Si la ficha guardada cambia (por ej. tras verificar identidad), el formulario se
  // vuelve a sembrar durante el render: con un efecto se vería un cuadro con datos viejos.
  const [syncedStamp, setSyncedStamp] = useState(profileStamp)
  if (syncedStamp !== profileStamp) {
    setSyncedStamp(profileStamp)
    setCuil(formatCuil(initialProfile?.cuil ?? ''))
    setDni(digits(initialProfile?.dni ?? '').slice(0, 8))
    setBirthDate(initialProfile?.birthDate ?? '')
    setPhone(initialProfile?.phone ?? '')
    setAddress(initialProfile?.address ?? '')
    setMonthlyIncome(incomeSeed(initialProfile?.monthlyIncome))
    setGeo({
      province: initialProfile?.province ?? '',
      department: initialProfile?.department ?? '',
      city: initialProfile?.city ?? '',
      postalCode: initialProfile?.postalCode ?? '',
    })
    setEmploymentStatus(initialProfile?.employmentStatus ?? '')
  }

  const [formState, action, isPending] = useActionState(
    async (_prev: { ok?: boolean; error?: string; message?: string } | null, formData: FormData) => {
      try {
        const res = await updateProfile({
          cuil: digits(String(formData.get('cuil') ?? '')),
          dni: digits(String(formData.get('dni') ?? '')),
          phone: String(formData.get('phone') ?? ''),
          birthDate: String(formData.get('birthDate') ?? ''),
          province: String(formData.get('province') ?? ''),
          department: String(formData.get('department') ?? ''),
          city: String(formData.get('city') ?? ''),
          postalCode: String(formData.get('postalCode') ?? ''),
          address: String(formData.get('address') ?? ''),
          monthlyIncome: Number(formData.get('monthlyIncome')) || 0,
          employmentStatus: String(formData.get('employmentStatus') ?? ''),
        })
        if (res.ok) {
          router.refresh()
          return { ok: true, message: 'Ficha guardada.' }
        }
        return { ok: false, error: 'No se pudo guardar la ficha.' }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    },
    null,
  )

  useEffect(() => {
    if (!formState?.ok) return
    document.getElementById('kyc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [formState?.ok])

  const kycStatusLabel: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    submitted: { label: 'En revisión', variant: 'outline' },
    reviewing: { label: 'En revisión', variant: 'outline' },
    verified: { label: 'Verificado', variant: 'default' },
    approved: { label: 'Aprobado', variant: 'default' },
  }
  const status = kycStatusLabel[initialProfile?.kycStatus ?? 'pending'] ?? kycStatusLabel.pending
  const fieldClass = identityLocked ? 'bg-muted/40 text-foreground' : undefined
  const employmentOptions =
    employmentStatus && !SITUACIONES_LABORALES.includes(employmentStatus)
      ? [employmentStatus, ...SITUACIONES_LABORALES]
      : SITUACIONES_LABORALES

  const checks = [
    { label: 'Identidad', ok: digits(cuil).length === 11 && digits(dni).length >= 7 && Boolean(birthDate) && digits(phone).length >= 8 },
    { label: 'Domicilio', ok: Boolean(geo.province && geo.department && geo.city && geo.postalCode && address.trim()) },
    { label: 'Ingresos', ok: Number(monthlyIncome) > 0 && Boolean(employmentStatus) && employmentStatus !== 'A completar' },
    { label: 'Didit', ok: diditApproved || initialProfile?.kycStatus === 'approved' },
    { label: 'BCRA', ok: Boolean(initialProfile?.bcraConsentAt) },
  ]

  function submitProfileChangeRequest() {
    setRequestMsg(null)
    startRequest(async () => {
      const res = await requestProfileChange({ reason: requestReason, fields: requestFields })
      if (res.ok) {
        setRequestMsg({
          ok: true,
          text: 'Pedido enviado. Lo seguís en Soporte y el equipo recibe el aviso.',
        })
        setShowRequest(false)
        setRequestReason('')
        setRequestFields('')
        router.refresh()
        return
      }
      setRequestMsg({ ok: false, text: res.error })
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" id="kyc-form">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {checks.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-semibold"
          >
            {item.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {item.label}
          </div>
        ))}
      </div>

      {identityLocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-brand-navy-200 bg-brand-navy-50 px-4 py-3 text-sm text-brand-navy-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <div>
            <p className="font-semibold">Ficha verificada · solo lectura</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-navy-600">
              CUIL, domicilio e ingresos quedan fijos después de Didit. Si hay un error, pedí el cambio: se abre un
              caso y te confirmamos por mail.
            </p>
          </div>
        </div>
      ) : null}

      {!diditApproved && initialProfile?.kycStatus !== 'approved' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>Falta la verificación biométrica. Sin Didit no se puede pedir un crédito.</p>
          {onOpenDidit ? (
            <Button type="button" size="sm" variant="outline" onClick={onOpenDidit}>
              <ShieldCheck className="h-4 w-4" /> Verificar con Didit
            </Button>
          ) : null}
        </div>
      ) : null}

      {requestMsg ? (
        <div
          className={
            requestMsg.ok
              ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          }
        >
          {requestMsg.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <AccountAvatar
                name={user?.name}
                email={user?.email}
                image={user?.image}
                size="lg"
                editable
              />
              <div>
                <CardTitle>{user?.name?.trim() || 'Ficha personal'}</CardTitle>
                <CardDescription>
                  {user?.email ? <span className="block text-foreground/80">{user.email}</span> : null}
                  {identityLocked
                    ? 'Datos del expediente. La foto de la cuenta sí se puede cambiar.'
                    : 'Completá identidad, domicilio e ingresos. El DNI se confirma con Didit.'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>

        <form action={identityLocked ? undefined : action}>
          <CardContent className="space-y-8">
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">
                Identidad
              </legend>
              <div className="space-y-2">
                <Label htmlFor="cuil">CUIL</Label>
                <Input
                  id="cuil"
                  name="cuil"
                  placeholder="20-12345678-3"
                  value={cuil}
                  onChange={(e) => setCuil(formatCuil(e.target.value))}
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  readOnly={identityLocked}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  name="dni"
                  placeholder="12345678"
                  value={dni}
                  onChange={(e) => setDni(digits(e.target.value).slice(0, 8))}
                  required
                  inputMode="numeric"
                  readOnly={identityLocked}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  readOnly={identityLocked}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="11 5555 5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  readOnly={identityLocked}
                  className={fieldClass}
                />
                <p className="text-xs text-muted-foreground">Con código de área, sin 0 ni 15.</p>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">Domicilio</legend>
              <input type="hidden" name="province" value={geo.province} />
              <input type="hidden" name="department" value={geo.department} />
              <input type="hidden" name="city" value={geo.city} />
              <input type="hidden" name="postalCode" value={geo.postalCode} />
              {identityLocked ? (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Provincia · </span>{geo.province || '—'}</p>
                  <p><span className="text-muted-foreground">Departamento · </span>{geo.department || '—'}</p>
                  <p><span className="text-muted-foreground">Localidad · </span>{geo.city || '—'}</p>
                  <p><span className="text-muted-foreground">CP · </span>{geo.postalCode || '—'}</p>
                </div>
              ) : (
                <GeoArFields value={geo} onChange={setGeo} />
              )}
              <div className="space-y-2">
                <Label htmlFor="address">Calle, número, piso y depto</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Av. Corrientes 1234, 4° B"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  autoComplete="street-address"
                  readOnly={identityLocked}
                  className={fieldClass}
                />
              </div>
            </fieldset>

            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-primary md:col-span-2">
                Capacidad de pago
              </legend>
              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Ingresos netos mensuales</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="monthlyIncome"
                    name="monthlyIncome"
                    type="number"
                    min="1"
                    step="1000"
                    placeholder="200000"
                    className={`pl-7 font-mono ${fieldClass ?? ''}`}
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    required
                    readOnly={identityLocked}
                  />
                </div>
                {Number(monthlyIncome) > 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">~ {formatARS(monthlyIncome)} / mes</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentStatus">Situación laboral</Label>
                <input type="hidden" name="employmentStatus" value={employmentStatus} />
                {identityLocked ? (
                  <Input value={employmentStatus || '—'} readOnly className={fieldClass} />
                ) : (
                  <Select value={employmentStatus || undefined} onValueChange={(v) => setEmploymentStatus(v ?? '')}>
                    <SelectTrigger id="employmentStatus" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {employmentOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </fieldset>

            {formState?.ok ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {formState.message}
              </div>
            ) : null}
            {formState?.ok === false && formState.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formState.error}
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-end gap-3 border-t">
            {identityLocked ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setShowRequest((v) => !v)}>
                <Send className="h-4 w-4" />
                {showRequest ? 'Cancelar pedido' : 'Pedir un cambio'}
              </Button>
            ) : (
              <>
                <p className="mr-auto text-xs text-muted-foreground">
                  La cuota ofrecida no supera el 35% de estos ingresos.
                </p>
                <Button type="submit" size="lg" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Guardar ficha
                    </>
                  )}
                </Button>
              </>
            )}
          </CardFooter>
        </form>
      </Card>

      {identityLocked && showRequest ? (
        <Card className="border-brand-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Pedido de cambio</CardTitle>
            <CardDescription>
              Se abre un caso en Soporte, categoría identidad. No modifiques los datos vos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-fields">Qué hay que corregir</Label>
              <Input
                id="change-fields"
                value={requestFields}
                onChange={(e) => setRequestFields(e.target.value)}
                placeholder="Domicilio, teléfono o fecha de nacimiento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">Detalle</Label>
              <Textarea
                id="change-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                placeholder="Dato incorrecto y valor correcto. Mínimo 20 caracteres."
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setShowRequest(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={requestPending || requestReason.trim().length < 20}
              onClick={submitProfileChangeRequest}
            >
              {requestPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar pedido
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {!initialProfile?.bcraConsentAt ? (
        <Card className="border-amber-200/80">
          <CardHeader>
            <CardTitle className="text-base">Central de Deudores</CardTitle>
            <CardDescription>
              Sin esta autorización no consultamos el BCRA ni se puede solicitar un crédito.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-3">
            {consentError ? <p className="text-sm text-destructive">{consentError}</p> : null}
            <Button
              type="button"
              variant="outline"
              disabled={consentPending}
              onClick={() => {
                setConsentError(null)
                startConsent(async () => {
                  try {
                    await grantBcraConsent()
                    router.refresh()
                  } catch (err) {
                    setConsentError((err as Error).message || 'No se pudo registrar la autorización.')
                  }
                })
              }}
            >
              {consentPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Autorizo la consulta a la Central de Deudores del BCRA
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">
          Consulta CENDEU autorizada el{' '}
          {new Date(initialProfile.bcraConsentAt).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/Argentina/Buenos_Aires',
          })}
          . Soporte: {BRAND.supportEmail}.
        </p>
      )}
    </div>
  )
}
