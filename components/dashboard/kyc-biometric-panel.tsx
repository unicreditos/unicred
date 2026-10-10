'use client'

import {
  SectionCard,
} from '@/components/unicred/dashboard-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  profile,
  kycVerification,
} from '@/lib/db/schema'
import { useMemo, useState, useEffect } from 'react'
import {
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

import { getDiditPublicConfig, syncDiditSession } from '@/app/actions/didit'
import { DiditVerifyButton } from '@/components/didit-verify-button'
import { IdentityGuide } from '@/components/identity-guide'
import { kycMediaBundle, parseDiditCapture } from '@/lib/didit-capture'

type Profile = typeof profile.$inferSelect
type KYCVerification = typeof kycVerification.$inferSelect


function kycLabel(s: string | null | undefined) {
  switch (s) {
    case 'approved':
      return 'Aprobado'
    case 'rejected':
      return 'Rechazado'
    case 'reviewing':
    case 'submitted':
      return 'En revisión'
    case 'pending':
      return 'Pendiente'
    case 'verified':
      return 'Verificado'
    default:
      return 'No iniciado'
  }
}
function kycVariant(s: string | null | undefined) {
  switch (s) {
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60'
    case 'rejected':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/60'
    case 'reviewing':
    case 'submitted':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-200/60'
    case 'verified':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60'
    case 'pending':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/60'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function KYCBiometricPanel({
  kyc,
  profile,
}: {
  kyc: KYCVerification | null
  profile: Profile | null
}) {
  const [diditConfigured, setDiditConfigured] = useState<boolean | null>(null)
  const [diditError, setDiditError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const approved = kyc?.status === 'approved' && kyc.provider === 'didit'
  const capture = useMemo(
    () => parseDiditCapture(kyc?.ocrData, { sessionId: kyc?.providerReferenceId, status: kyc?.status }),
    [kyc?.ocrData, kyc?.providerReferenceId, kyc?.status],
  )
  const media = useMemo(
    () =>
      kycMediaBundle(capture, {
        front: kyc?.dniFrontImageUrl,
        back: kyc?.dniBackImageUrl,
        selfie: kyc?.selfieImageUrl,
      }),
    [capture, kyc?.dniFrontImageUrl, kyc?.dniBackImageUrl, kyc?.selfieImageUrl],
  )
  const id = capture.ids[0]
  const shots = [
    { label: 'DNI frente', url: media.front },
    { label: 'DNI dorso', url: media.back },
    { label: 'Selfie / prueba de vida', url: media.selfie },
  ].filter((s) => s.url)

  useEffect(() => {
    void getDiditPublicConfig().then((cfg) => setDiditConfigured(cfg.configured))
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <SectionCard
        title="Identidad Didit"
        description="La verificación se hace dentro de UNICRÉDITOS: DNI, prueba de vida y coincidencia facial."
        icon={<ShieldCheck className="h-4 w-4" />}
        className="lg:col-span-2"
        bodyClassName="space-y-4 p-4 text-sm sm:p-5"
        action={
          <Badge variant="outline" className={cn('border px-2.5 py-1', kycVariant(kyc?.status))}>
            {kycLabel(kyc?.status)}
          </Badge>
        }
      >
          <p className="text-muted-foreground">
            UNICRÉDITOS no recibe fotos ni videos cargados a mano. El flujo de Didit se abre acá, sin salir de la web.
          </p>
          {id?.fullName || id?.documentNumber || kyc?.dniNumber ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground">{id?.fullName || 'Documento verificado'}</p>
              <p className="mt-1 font-mono text-muted-foreground">
                DNI {id?.documentNumber || kyc?.dniNumber || '—'}
                {id?.birthDate ? ` · Nac. ${id.birthDate}` : ''}
              </p>
            </div>
          ) : null}
          {kyc?.rejectionReason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
              <AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />
              <span className="font-semibold">Rechazado:</span> {kyc.rejectionReason}
            </div>
          )}
          {kyc?.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              Revisado el {new Date(kyc.reviewedAt as any).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
              {kyc?.reviewedBy && ` · ${kyc.reviewedBy === 'didit' ? 'Didit' : `Operador #${kyc.reviewedBy.slice(0, 6)}`}`}
            </p>
          )}
          {kyc?.provider === 'didit' && kyc.providerReferenceId && (
            <p className="font-mono text-xs text-muted-foreground">Sesión Didit {kyc.providerReferenceId}</p>
          )}
          {kyc?.faceMatchScore != null && (
            <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
              Face match {String(kyc.faceMatchScore)}%
            </p>
          )}
        </SectionCard>

      <SectionCard
        title="Verificar con Didit"
        description="Completá DNI y prueba de vida acá, sin salir de UNICRÉDITOS. Sin aprobación de Didit no se puede solicitar crédito."
        className="lg:col-span-3"
        bodyClassName="space-y-3 p-4 sm:p-5"
      >
          {shots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {shots.map((s) => (
                <figure key={s.label} className="overflow-hidden rounded-lg border bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url!} alt={s.label} className="h-28 w-full object-cover" referrerPolicy="no-referrer" />
                  <figcaption className="px-2 py-1 text-[10px] text-muted-foreground">{s.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {diditConfigured === null ? (
            <p className="text-sm text-muted-foreground">Comprobando Didit…</p>
          ) : !diditConfigured ? (
            <p className="text-sm text-destructive">
              Didit no está configurado. Falta DIDIT_API_KEY en el proceso de Next. Reiniciá `next dev`.
            </p>
          ) : approved ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Tu identidad ya está verificada por Didit.
            </p>
          ) : (
            <>
              <IdentityGuide variant="compact" />
              <DiditVerifyButton
                mode="session"
                dni={kyc?.dniNumber ?? profile?.dni ?? undefined}
                birthDate={profile?.birthDate ?? undefined}
                phone={profile?.phone ?? undefined}
                className="w-full"
                onError={setDiditError}
                onCompleted={() => router.refresh()}
              />
              {kyc?.providerReferenceId && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={syncing}
                  onClick={() => {
                    setSyncing(true)
                    void syncDiditSession(kyc.providerReferenceId ?? undefined)
                      .then((res) => {
                        if (!res.ok) setDiditError(res.error)
                        else router.refresh()
                      })
                      .finally(() => setSyncing(false))
                  }}
                >
                  Actualizar resultado Didit
                </Button>
              )}
            </>
          )}
          {diditError && <p className="text-sm text-destructive">{diditError}</p>}
      </SectionCard>
    </div>
  )
}

