'use client'

import { Download, Printer, RefreshCw, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { activateCollectionPos, refreshCollections } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'

/** Primera vez: abre la caja de cobro (PDV) de la persona en Mercado Pago. */
export function QrActivate({ canActivate, reason }: { canActivate: boolean; reason?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <Store className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Activá tu caja de cobro</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Creamos un punto de venta propio en Mercado Pago, ligado a tu billetera. Tiene su QR permanente y desde ahí generás los QR con importe.
            Todo lo que te paguen se acredita en tu billetera.
          </p>
          {reason ? <p className="mt-2 text-sm text-warning">{reason}</p> : null}
          {error ? <Alert variant="destructive" className="mt-3">{error}</Alert> : null}
        </div>
      </div>
      <Button
        size="lg"
        disabled={pending || !canActivate}
        className="shrink-0"
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await activateCollectionPos()
            if (!r.ok) return setError(r.error)
            toast.success('Caja de cobro activada')
            router.refresh()
          })
        }
      >
        {pending ? 'Activando…' : 'Activar caja de cobro'}
      </Button>
    </Card>
  )
}

/** QR permanente de la caja: cualquiera puede pagarlo desde su banco o Mercado Pago y elige el importe. */
export function QrPosCard({
  name,
  svg,
  imageUrl,
  templateUrl,
  collectedCount,
  collectedTotal,
}: {
  name: string
  svg: string | null
  imageUrl: string | null
  templateUrl: string | null
  collectedCount: number
  collectedTotal: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function download() {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'qr-permanente-unicreditos.svg'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Card className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
      {svg ? (
        <div
          className="w-full max-w-[200px] shrink-0 rounded-xl border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label="Tu código QR permanente de Mercado Pago"
        />
      ) : imageUrl ? (
        // Imagen que entrega Mercado Pago para la caja (el código de texto no vino en la respuesta de la cuenta).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Tu código QR permanente de Mercado Pago" className="w-full max-w-[200px] shrink-0 rounded-xl border bg-white p-2" />
      ) : (
        <p className="text-sm text-muted-foreground">Mercado Pago todavía no entregó el QR de tu caja. Tocá Actualizar.</p>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">Tu QR permanente · {name}</p>
        <h2 className="mt-0.5 text-lg font-semibold">Tu QR fijo: imprimilo o mostralo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para cobrar, cargá el importe abajo y tildá «Cobrar en mi QR permanente»: quien lo escanee desde cualquier banco o billetera verá ese monto. Sin un cobro cargado, el QR no tiene qué cobrar. Cada pago se acredita en tu billetera apenas Mercado Pago lo confirma.
        </p>
        <p className="mt-3 text-sm">
          <span className="tnum font-semibold">{formatMoney(collectedTotal)}</span>
          <span className="text-muted-foreground"> cobrados en {collectedCount} {collectedCount === 1 ? 'pago' : 'pagos'}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {svg ? (
            <Button variant="outline" size="sm" onClick={download}>
              <Download />
              Descargar
            </Button>
          ) : null}
          {templateUrl ? (
            <a href={templateUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Printer />
              Cartel para imprimir
            </a>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await refreshCollections()
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                if (Number(r.credited) > 0) toast.success(`Se acreditaron ${formatMoney(r.credited)}`)
                else toast('Todo al día')
                router.refresh()
              })
            }
          >
            <RefreshCw className={pending ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        </div>
      </div>
    </Card>
  )
}
