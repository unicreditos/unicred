'use client'

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
import { formatARS } from '@/lib/finance'
import { profile } from '@/lib/db/schema'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AccountAvatar } from '@/components/unicred/account-avatar'
import { CheckCircle2, Loader2 } from 'lucide-react'

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

export function KYCProfileForm({
  initialProfile,
  user,
}: {
  initialProfile: Profile | null
  user?: { name?: string | null; email?: string | null; image?: string | null }
}) {
  const router = useRouter()
  const [consentPending, startConsent] = useTransition()
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

  const kycStatusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    submitted: { label: 'En revisión', variant: 'outline' },
    reviewing: { label: 'En revisión', variant: 'outline' },
    verified: { label: 'Verificado', variant: 'default' },
    approved: { label: 'Aprobado', variant: 'default' },
    rejected: { label: 'Rechazado', variant: 'destructive' },
  }

  const status = kycStatusLabel[initialProfile?.kycStatus ?? 'pending'] ?? kycStatusLabel.pending

  return (
    <div className="mx-auto max-w-3xl" id="kyc-form">
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
                <CardTitle>Perfil y validación KYC</CardTitle>
                <CardDescription>
                  Completá CUIL, domicilio e ingresos. El DNI y la biometría se verifican solo con Didit, en la misma solicitud.
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>

        <form action={action}>
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
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <input type="hidden" name="province" value={geo.province} />
              <input type="hidden" name="department" value={geo.department} />
              <input type="hidden" name="city" value={geo.city} />
              <input type="hidden" name="postalCode" value={geo.postalCode} />
              <GeoArFields value={geo} onChange={setGeo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección *</Label>
              <Input
                id="address"
                name="address"
                placeholder="Calle y número, piso, dpto."
                defaultValue={initialProfile?.address ?? ''}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyIncome">Ingresos mensuales (ARS) *</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">
                  $
                </span>
                <Input
                  id="monthlyIncome"
                  name="monthlyIncome"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="200.000"
                  className="pl-7 font-mono"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  required
                />
              </div>
              {monthlyIncome && !isNaN(Number(monthlyIncome)) && Number(monthlyIncome) > 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  ~ {formatARS(monthlyIncome)} / mes
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Situación laboral *</Label>
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
            </div>

            {formState?.ok && (
              <div className="md:col-span-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {formState.message}
              </div>
            )}
            {formState?.ok === false && formState.error && (
              <div className="md:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formState.error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-end gap-3 border-t">
            <p className="mr-auto text-xs text-muted-foreground">
              * Campos obligatorios. Los datos se encriptan y solo se usan para la evaluación crediticia.
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
          </CardFooter>
        </form>
      </Card>
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
          .
        </p>
      )}
    </div>
  )
}
