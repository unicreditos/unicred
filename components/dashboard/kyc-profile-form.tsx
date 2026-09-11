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
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AccountAvatar } from '@/components/unicred/account-avatar'
import { CheckCircle2, Loader2, Lock, Send } from 'lucide-react'

type Profile = typeof profile.$inferSelect

const SITUACIONES_LABORALES = [
  'Relación de dependencia',
  'Monotributista',
  'Autónomo',
  'Profesional independiente',
  'Jubilado / Pensionado',
  'Desempleado',
  'A completar',
  'Otro',
]

export function KYCProfileForm({
  initialProfile,
  user,
}: {
  initialProfile: Profile | null
  user?: { name?: string | null; email?: string | null; image?: string | null }
}) {
  const router = useRouter()
  const [consentPending, startConsent] = useTransition()
  const [requestPending, startRequest] = useTransition()
  const [showRequest, setShowRequest] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestFields, setRequestFields] = useState('')
  const [requestMsg, setRequestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const identityLocked = initialProfile?.kycStatus === 'approved'

  const [formState, action, isPending] = useActionState(
    async (_prev: { ok?: boolean; error?: string; message?: string } | null, formData: FormData) => {
      try {
        const monthlyIncomeStr = formData.get('monthlyIncome') as string
        const res = await updateProfile({
          cuil: (formData.get('cuil') as string).replace(/\D/g, ''),
          dni: (formData.get('dni') as string).replace(/\D/g, ''),
          phone: formData.get('phone') as string,
          birthDate: formData.get('birthDate') as string,
          province: formData.get('province') as string,
          department: formData.get('department') as string,
          city: formData.get('city') as string,
          postalCode: formData.get('postalCode') as string,
          address: formData.get('address') as string,
          monthlyIncome: Number(monthlyIncomeStr) || 0,
          employmentStatus: formData.get('employmentStatus') as string,
        })
        if (res.ok) {
          router.refresh()
          return { ok: true, message: 'Perfil guardado correctamente.' }
        }
        return { ok: false, error: 'No se pudo guardar el perfil.' }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    },
    null,
  )

  const [monthlyIncome, setMonthlyIncome] = useState<string>(
    initialProfile?.monthlyIncome ? String(initialProfile.monthlyIncome) : '',
  )
  const [geo, setGeo] = useState<GeoValue>({
    province: initialProfile?.province ?? '',
    department: initialProfile?.department ?? '',
    city: initialProfile?.city ?? '',
    postalCode: initialProfile?.postalCode ?? '',
  })
  const [employmentStatus, setEmploymentStatus] = useState<string>(
    initialProfile?.employmentStatus ?? '',
  )

  useEffect(() => {
    if (formState?.ok) {
      const t = setTimeout(() => {
        document.getElementById('kyc-form')?.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(t)
    }
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
    rejected: { label: 'Rechazado', variant: 'destructive' },
  }

  const status = kycStatusLabel[initialProfile?.kycStatus ?? 'pending'] ?? kycStatusLabel.pending
  const fieldClass = identityLocked ? 'bg-muted/40 text-foreground' : undefined

  function submitProfileChangeRequest() {
    setRequestMsg(null)
    startRequest(async () => {
      const res = await requestProfileChange({ reason: requestReason, fields: requestFields })
      if (res.ok) {
        setRequestMsg({
          ok: true,
          text: 'Pedido enviado. Vas a ver el caso en Reclamos y ops recibe el aviso.',
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
      {identityLocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-brand-navy-200 bg-brand-navy-50 px-4 py-3 text-sm text-brand-navy-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <div>
            <p className="font-semibold">Ficha verificada · solo lectura</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-navy-600">
              Los datos aprobados con Didit no se editan desde el panel. Pedí el cambio a UNICRÉDITOS: se abre un
              caso de identidad para el equipo y recibís confirmación por mail.
            </p>
          </div>
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
                editable={!identityLocked}
              />
              <div>
                <CardTitle>Ficha personal</CardTitle>
                <CardDescription>
                  {identityLocked
                    ? 'Identidad y domicilio registrados en tu expediente UNICRÉDITOS.'
                    : 'Completá CUIL, domicilio e ingresos. El DNI y la biometría se verifican con Didit.'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>

        <form action={identityLocked ? undefined : action}>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cuil">CUIL *</Label>
              <Input
                id="cuil"
                name="cuil"
                placeholder="00-12345678-0"
                defaultValue={initialProfile?.cuil ?? ''}
                required
                inputMode="numeric"
                readOnly={identityLocked}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dni">DNI *</Label>
              <Input
                id="dni"
                name="dni"
                placeholder="12345678"
                defaultValue={initialProfile?.dni ?? ''}
                required
                inputMode="numeric"
                readOnly={identityLocked}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={initialProfile?.birthDate ?? ''}
                required
                readOnly={identityLocked}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="11 1234-5678"
                defaultValue={initialProfile?.phone ?? ''}
                required
                readOnly={identityLocked}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <input type="hidden" name="province" value={geo.province} />
              <input type="hidden" name="department" value={geo.department} />
              <input type="hidden" name="city" value={geo.city} />
              <input type="hidden" name="postalCode" value={geo.postalCode} />
              {identityLocked ? (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Provincia · </span>
                    {geo.province || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Departamento · </span>
                    {geo.department || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Localidad · </span>
                    {geo.city || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">CP · </span>
                    {geo.postalCode || '—'}
                  </p>
                </div>
              ) : (
                <GeoArFields value={geo} onChange={setGeo} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección *</Label>
              <Input
                id="address"
                name="address"
                placeholder="Calle y número, piso, dpto."
                defaultValue={initialProfile?.address ?? ''}
                required
                readOnly={identityLocked}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyIncome">Ingresos mensuales (ARS) *</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="monthlyIncome"
                  name="monthlyIncome"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="200.000"
                  className={`pl-7 font-mono ${fieldClass ?? ''}`}
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  required
                  readOnly={identityLocked}
                />
              </div>
              {monthlyIncome && !isNaN(Number(monthlyIncome)) && Number(monthlyIncome) > 0 && (
                <p className="font-mono text-xs text-muted-foreground">~ {formatARS(monthlyIncome)} / mes</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Situación laboral *</Label>
              {identityLocked ? (
                <>
                  <Input value={employmentStatus || '—'} readOnly className={fieldClass} />
                  <input type="hidden" name="employmentStatus" value={employmentStatus} />
                </>
              ) : (
                <Select
                  name="employmentStatus"
                  value={employmentStatus}
                  onValueChange={(v) => setEmploymentStatus(v ?? '')}
                  required
                >
                  <SelectTrigger id="employmentStatus" className="w-full">
                    <SelectValue placeholder="Seleccioná una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACIONES_LABORALES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {formState?.ok && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 md:col-span-2 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {formState.message}
              </div>
            )}
            {formState?.ok === false && formState.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive md:col-span-2">
                {formState.error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-end gap-3 border-t">
            {identityLocked ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setShowRequest((v) => !v)}>
                <Send className="h-4 w-4" />
                {showRequest ? 'Cancelar pedido' : 'Pedir cambio a UNICRÉDITOS'}
              </Button>
            ) : (
              <>
                <p className="mr-auto text-xs text-muted-foreground">
                  * Campos obligatorios. Solo se usan para evaluación crediticia.
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
                      Guardar perfil
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
            <CardTitle className="text-base">Pedido de cambio de ficha</CardTitle>
            <CardDescription>
              Se crea un caso en Reclamos (categoría identidad) y ops recibe el aviso. No edites datos vos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-fields">Qué querés corregir</Label>
              <Input
                id="change-fields"
                value={requestFields}
                onChange={(e) => setRequestFields(e.target.value)}
                placeholder="Ej. domicilio, teléfono, fecha de nacimiento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">Detalle *</Label>
              <Textarea
                id="change-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                placeholder="Explicá el dato incorrecto y el valor correcto (mín. 20 caracteres)."
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
            <CardTitle className="text-base">Autorización CENDEU</CardTitle>
            <CardDescription>
              Sin esta autorización no se puede consultar la Central de Deudores ni solicitar un crédito.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              disabled={consentPending}
              onClick={() => {
                startConsent(async () => {
                  await grantBcraConsent()
                  router.refresh()
                })
              }}
            >
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
