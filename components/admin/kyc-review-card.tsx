'use client'

import { refreshKycDidit, setKYCStatus } from '@/app/actions/kyc'
import { adminUrl } from '@/lib/admin-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  CreditCard,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  User as UserIcon,
  UserCheck,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export type KYCAdminRow = {
  id: string
  userId: string
  dniFrontImageUrl: string | null
  dniBackImageUrl: string | null
  selfieImageUrl: string | null
  dniNumber: string | null
  verificationLevel: string | null
  status: string
  faceMatchScore: string | number | null
  provider: string | null
  providerReferenceId?: string | null
  rejectionReason: string | null
  cuilVerified?: boolean
  phoneVerified?: boolean
  emailVerified?: boolean
  reviewedAt?: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  diditStatus?: string | null
  ocr?: {
    fullName: string | null
    documentType: string | null
    birthDate: string | null
    nationality: string | null
    address: string | null
    expirationDate: string | null
    status: string
  } | null
  warnings?: string[]
  aml?: string[]
  ip?: { country: string | null; isp: string | null; isVpn: boolean | null } | null
  media?: Array<{ label: string; url: string; kind: 'image' | 'video' }>
  user: {
    fullName: string | null
    cuil: string | null
    dni?: string | null
    email: string | null
    phone: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    birthDate?: string | null
    kycStatus?: string | null
  } | null
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-AR')
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'bg-amber-500/15 text-amber-700 border-amber-200/60' },
    reviewing: { label: 'En revisión', cls: 'bg-sky-500/15 text-sky-700 border-sky-200/60' },
    submitted: { label: 'Enviado', cls: 'bg-sky-500/15 text-sky-700 border-sky-200/60' },
    approved: { label: 'Aprobado', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-200/60' },
    rejected: { label: 'Rechazado', cls: 'bg-rose-500/15 text-rose-700 border-rose-200/60' },
  }
  const cfg = map[s] ?? { label: s, cls: 'bg-slate-100 text-slate-700' }
  return (
    <Badge variant="outline" className={cn('border text-[11px]', cfg.cls)}>
      {cfg.label}
    </Badge>
  )
}

function DocPreview({ label, url, icon }: { label: string; url: string | null; icon: React.ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-muted/20">
      <div className="aspect-[4/3] bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {icon}
            <p className="text-[11px]">Sin captura</p>
          </div>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className="font-medium">{label}</span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">
            Abrir
          </a>
        ) : null}
      </figcaption>
    </figure>
  )
}

export function KYCReviewCard({ kyc }: { kyc: KYCAdminRow }) {
  const router = useRouter()
  const [reason, setReason] = useState('Documentos ilegibles / datos no coincidentes')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const extraMedia = (kyc.media ?? []).filter(
    (item) => item.url !== kyc.dniFrontImageUrl && item.url !== kyc.dniBackImageUrl && item.url !== kyc.selfieImageUrl,
  )

  function run(fn: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(ok)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción')
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{kyc.user?.fullName ?? kyc.ocr?.fullName ?? `Cliente #${kyc.userId.slice(0, 8)}`}</CardTitle>
                {statusBadge(kyc.status)}
                <Badge variant="outline" className="text-[10px]">
                  {kyc.provider === 'didit' ? 'Didit' : kyc.provider ?? 'sin proveedor'}
                </Badge>
                {kyc.diditStatus ? (
                  <Badge variant="outline" className="text-[10px]">
                    Sesión {kyc.diditStatus}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-1 space-x-1">
                {(kyc.user?.cuil || kyc.dniNumber) && (
                  <>
                    {kyc.user?.cuil ? (
                      <>
                        CUIL <span className="font-mono font-medium">{kyc.user.cuil}</span>
                      </>
                    ) : null}
                    {kyc.dniNumber ? (
                      <>
                        {kyc.user?.cuil ? ' · ' : null}DNI <span className="font-mono font-medium">{kyc.dniNumber}</span>
                      </>
                    ) : null}
                    {' · '}
                  </>
                )}
                {kyc.user?.email}
                {kyc.user?.phone ? ` · ${kyc.user.phone}` : null}
              </CardDescription>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Actualizado {formatDate(kyc.updatedAt)}</div>
            {kyc.faceMatchScore != null && (
              <div className="mt-1 font-semibold text-emerald-700">Face match {String(kyc.faceMatchScore)}%</div>
            )}
            {kyc.providerReferenceId ? (
              <div className="mt-1 max-w-[16rem] truncate font-mono text-[10px]">Didit {kyc.providerReferenceId}</div>
            ) : null}
            <Link href={adminUrl('usuarios', kyc.userId)} className="mt-2 inline-flex text-[11px] font-medium text-brand-primary hover:underline">
              Abrir ficha completa
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 sm:grid-cols-3">
        <DocPreview label="DNI frente" url={kyc.dniFrontImageUrl} icon={<CreditCard className="h-5 w-5" />} />
        <DocPreview label="DNI dorso" url={kyc.dniBackImageUrl} icon={<CreditCard className="h-5 w-5 rotate-180" />} />
        <DocPreview label="Selfie / liveness" url={kyc.selfieImageUrl} icon={<UserIcon className="h-5 w-5" />} />
      </CardContent>

      {extraMedia.length > 0 ? (
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-3">
          {extraMedia.map((item) =>
            item.kind === 'video' ? (
              <figure key={item.url} className="overflow-hidden rounded-xl border">
                <video src={item.url} controls className="aspect-video w-full bg-black object-contain" />
                <figcaption className="px-3 py-2 text-xs">{item.label}</figcaption>
              </figure>
            ) : (
              <DocPreview key={item.url} label={item.label} url={item.url} icon={<UserIcon className="h-4 w-4" />} />
            ),
          )}
        </CardContent>
      ) : null}

      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <Field label="Nombre OCR" value={kyc.ocr?.fullName} />
        <Field label="Tipo documento" value={kyc.ocr?.documentType} />
        <Field label="Nacimiento" value={kyc.ocr?.birthDate || kyc.user?.birthDate} />
        <Field label="Nacionalidad" value={kyc.ocr?.nationality} />
        <Field label="Domicilio Didit" value={kyc.ocr?.address} />
        <Field label="Domicilio declarado" value={[kyc.user?.address, kyc.user?.city, kyc.user?.province].filter(Boolean).join(' · ') || null} />
        <Field label="Vencimiento DNI" value={kyc.ocr?.expirationDate} />
        <Field
          label="Verificaciones"
          value={[
            kyc.cuilVerified ? 'CUIL' : null,
            kyc.phoneVerified ? 'Teléfono' : null,
            kyc.emailVerified ? 'Email' : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Pendientes'}
        />
        {kyc.ip ? <Field label="IP" value={[kyc.ip.country, kyc.ip.isp, kyc.ip.isVpn ? 'VPN/Tor' : null].filter(Boolean).join(' · ')} /> : null}
        {kyc.aml?.length ? <Field label="AML" value={kyc.aml.join(' · ')} /> : null}
      </CardContent>

      {kyc.warnings?.length ? (
        <CardContent className="pt-0">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{kyc.warnings.join(' · ')}</p>
          </div>
        </CardContent>
      ) : null}

      {kyc.rejectionReason ? (
        <CardContent className="pt-0">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <strong>Motivo de rechazo:</strong> {kyc.rejectionReason}
          </div>
        </CardContent>
      ) : null}

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {kyc.provider === 'didit' ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <FileCheck2 className="h-3.5 w-3.5" /> Captura automática Didit
            </span>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-300/60 text-amber-700">
              Sin sesión Didit
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || !kyc.providerReferenceId}
            className="gap-1"
            onClick={() => run(() => refreshKycDidit(kyc.userId), 'Documentos Didit actualizados')}
          >
            <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} /> Traer documentos Didit
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-rose-700 border-rose-200/60 hover:bg-rose-50">
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Rechazar validación de identidad</DialogTitle>
                <DialogDescription>El cliente recibe un correo y debe rehacer Didit.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-2">
                <Label>Motivo</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={isPending || !reason.trim()}
                  onClick={() => {
                    setOpen(false)
                    run(() => setKYCStatus(kyc.id, 'rejected', reason.trim()), 'KYC rechazado')
                  }}
                >
                  Confirmar rechazo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {kyc.status === 'approved' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => setKYCStatus(kyc.id, 'reviewing'), 'Revisión reabierta')}
            >
              Reabrir revisión
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isPending}
              className="gap-1 bg-emerald-600 hover:bg-emerald-600"
              onClick={() => run(() => setKYCStatus(kyc.id, 'approved'), 'KYC aprobado')}
            >
              <CheckCircle2 className="h-4 w-4" /> Aprobar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}
