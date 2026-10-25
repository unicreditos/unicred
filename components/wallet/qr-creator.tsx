'use client'

import { CheckCircle2, Clock, Download, QrCode, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cancelCollectionQr, createCollectionQr, getCollectionQrStatus } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CopyButton } from '@/components/wallet/copy-button'
import { formatMoney } from '@/lib/money'

type Created = { orderId: string; svg: string | null; code: string | null; amount: string; concept: string | null; expiresAt: string | null; permanent: boolean }

const TTLS = [
  { label: '15 minutos', value: 15 },
  { label: '1 hora', value: 60 },
  { label: '24 horas', value: 60 * 24 },
  { label: '7 días', value: 60 * 24 * 7 },
]

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** QR de Mercado Pago con importe: se genera, se espera el pago en la misma pantalla y se acredita en la billetera. */
export function QrCreator() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [ttl, setTtl] = useState(60)
  const [permanent, setPermanent] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [status, setStatus] = useState<string>('created')
  const [left, setLeft] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const waiting = created !== null && status === 'created'

  useEffect(() => {
    if (!created || status !== 'created') return
    const expiry = created.expiresAt ? new Date(created.expiresAt).getTime() : null
    const tick = setInterval(() => {
      if (expiry) setLeft(Math.max(0, Math.round((expiry - Date.now()) / 1000)))
    }, 1000)
    const poll = setInterval(async () => {
      const r = await getCollectionQrStatus(created.orderId)
      if (!r.ok || r.status === 'created') return
      setStatus(r.status)
      if (r.status === 'paid') {
        toast.success(`Cobraste ${formatMoney(created.amount)}`)
        router.refresh()
      }
    }, 4000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [created, status, router])

  function generate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await createCollectionQr({ amount, concept, ttlMinutes: ttl, permanent })
      if (!res.ok) return setError(res.error)
      setCreated({ orderId: res.orderId, svg: res.svg, code: res.code, amount: res.amount, concept: res.concept, expiresAt: res.expiresAt, permanent: res.permanent })
      setLeft(res.expiresAt ? Math.max(0, Math.round((new Date(res.expiresAt).getTime() - Date.now()) / 1000)) : null)
      setStatus('created')
      router.refresh()
    })
  }

  function cancel() {
    if (!created) return
    start(async () => {
      const res = await cancelCollectionQr(created.orderId)
      if (!res.ok) return setError(res.error)
      setStatus('cancelled')
      router.refresh()
    })
  }

  function download() {
    if (!created?.svg) return
    const blob = new Blob([created.svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'qr-cobro-unicreditos.svg'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Cobrar un importe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera un QR de Mercado Pago por el monto exacto. Quien lo escanea paga con cualquier billetera o banco y el dinero llega a tu billetera.
        </p>
        <form onSubmit={generate} className="mt-5 flex flex-col gap-5">
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <Field id="qr-amount" label="Importe">
            <Input id="qr-amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="tnum" />
          </Field>
          <Field id="qr-concept" label="Concepto (opcional)">
            <Input id="qr-concept" value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={100} placeholder="Ej. Cuota de agosto" />
          </Field>
          <Field id="qr-ttl" label="Vigencia del QR">
            <select
              id="qr-ttl"
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {TTLS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="mt-0.5 size-4 rounded border-input accent-primary" />
            <span>
              Cobrar en mi QR permanente
              <span className="block text-[13px] text-muted-foreground">
                No se genera otro código: quien escanee tu QR fijo (el de arriba) verá este importe. Solo puede haber un cobro abierto a la vez.
              </span>
            </span>
          </label>
          <Button type="submit" size="lg" disabled={pending || waiting} className="self-start">
            <QrCode />
            {pending ? 'Generando…' : 'Generar QR'}
          </Button>
        </form>
      </Card>

      <Card className="flex min-h-[18rem] flex-col items-center justify-center gap-4 p-5 sm:p-6 lg:w-[22rem]" aria-live="polite">
        {!created ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <QrCode className="size-10" aria-hidden="true" />
            <p>Acá vas a ver el QR del cobro y cuándo te pagan.</p>
          </div>
        ) : status === 'paid' ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
            <p className="text-lg font-semibold">¡Cobrado!</p>
            <p className="tnum text-2xl font-semibold">{formatMoney(created.amount)}</p>
            <p className="text-sm text-muted-foreground">Ya está en tu billetera.</p>
            <Button variant="outline" size="sm" onClick={() => setCreated(null)}>
              Nuevo cobro
            </Button>
          </div>
        ) : status !== 'created' ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <XCircle className="size-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-semibold">{status === 'cancelled' ? 'Cobro anulado' : 'El QR venció'}</p>
            <p className="text-sm text-muted-foreground">Generá uno nuevo para cobrar.</p>
            <Button variant="outline" size="sm" onClick={() => setCreated(null)}>
              Nuevo cobro
            </Button>
          </div>
        ) : (
          <>
            {created.svg ? (
              <div
                className="w-full max-w-[280px] rounded-xl border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                // El SVG lo genera el servidor con la librería qrcode a partir del código EMV que devuelve Mercado Pago.
                dangerouslySetInnerHTML={{ __html: created.svg }}
                role="img"
                aria-label={`Código QR de Mercado Pago por ${formatMoney(created.amount)}`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/40 p-5 text-center text-sm">
                <QrCode className="size-9 text-primary" aria-hidden="true" />
                <p className="font-medium">Cobrando en tu QR permanente</p>
                <p className="text-muted-foreground">Pedile que escanee el QR fijo de tu caja: va a ver este importe.</p>
              </div>
            )}
            <div className="text-center">
              <p className="tnum text-2xl font-semibold">{formatMoney(created.amount)}</p>
              {created.concept ? <p className="text-sm text-muted-foreground">{created.concept}</p> : null}
              <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                Esperando el pago{left != null ? ` · vence en ${clock(left)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {created.svg ? (
                <Button variant="outline" size="sm" onClick={download}>
                  <Download />
                  Descargar
                </Button>
              ) : null}
              {created.code ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-3 text-[13px] text-muted-foreground">
                  Código <CopyButton value={created.code} label="el código de pago" />
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Anular
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
