import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDiditReturnPath, syncDiditSession } from '@/app/actions/didit'
import { DiditEmbedReturn } from '@/components/didit-embed-return'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandLogo } from '@/components/unicred/dashboard-kit'

function labelFor(status: string | null | undefined) {
  switch (status) {
    case 'Approved':
      return 'Identidad verificada'
    case 'Declined':
      return 'Didit rechazó la verificación'
    case 'In Review':
      return 'Didit dejó el caso en revisión'
    case 'Resubmitted':
      return 'Didit pidió que reintentés la verificación'
    case 'In Progress':
    case 'Not Started':
      return 'La verificación todavía no terminó'
    case 'Abandoned':
      return 'La sesión se abandonó'
    default:
      return 'Verificación recibida'
  }
}

export default async function DiditCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sessionId = String(params.verificationSessionId ?? params.session_id ?? params.sessionId ?? '')
  const hinted = String(params.status ?? '')
  const embed = String(params.embed ?? '') === '1'
  const synced = sessionId ? await syncDiditSession(sessionId).catch(() => null) : null
  const status = synced && 'status' in synced ? String(synced.status) : hinted
  const next = await getDiditReturnPath()

  if (!embed && status === 'Approved' && next !== '/sign-up') {
    redirect(next)
  }

  if (embed) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
        <DiditEmbedReturn status={status} />
        <div className="max-w-sm text-center">
          <BrandLogo showText className="mx-auto h-7 justify-center" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">{labelFor(status)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El resultado quedó registrado en UNICRÉDITOS. Podés cerrar este panel y seguir.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <DiditEmbedReturn status={status} />
      <Card className="w-full max-w-lg space-y-5 p-6">
        <BrandLogo />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{labelFor(status)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === 'Approved'
              ? 'Ya podemos usar el resultado de Didit para tu KYC UNICRÉDITOS.'
              : 'Si cerraste el panel antes de terminar, volvé a iniciar la verificación desde tu cuenta. No hace falta salir de UNICRÉDITOS.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1">
            <Link href={next}>{next === '/sign-up' ? 'Volver al registro' : 'Ir a mi cuenta'}</Link>
          </Button>
          {sessionId && status !== 'Approved' && (
            <Button asChild variant="outline">
              <Link href={`/dashboard?tab=kyc_biometrico`}>Reintentar</Link>
            </Button>
          )}
        </div>
      </Card>
    </main>
  )
}
