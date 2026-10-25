'use client'

import Link from 'next/link'
import { CheckCircle2, ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { payQr, previewQr } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'

type Preview = { token: string; payee: string; alias: string; amount: string | null; concept: string | null; isOwn: boolean }
type Done = { reference: string; payee: string; amount: string; balance: string }

// BarcodeDetector no está en los tipos de TypeScript de todas las versiones.
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector
  }
}

export type InitialQr = { ok: true; token: string; payee: string; alias: string; amount: string | null; concept: string | null; isOwn: boolean } | { ok: false; error: string } | null

export function QrPayer({ initial, balance, canSend }: { initial: InitialQr; balance: string; canSend: boolean }) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<Preview | null>(initial && initial.ok ? { token: initial.token, payee: initial.payee, alias: initial.alias, amount: initial.amount, concept: initial.concept, isOwn: initial.isOwn } : null)
  const [amount, setAmount] = useState('')
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(initial && !initial.ok ? initial.error : null)
  const [done, setDone] = useState<Done | null>(null)
  const [scanning, setScanning] = useState(false)
  const [pending, start] = useTransition()
  const videoRef = useRef<HTMLVideoElement>(null)

  function load(value: string) {
    setError(null)
    start(async () => {
      const res = await previewQr(value)
      if (!res.ok) return setError(res.error)
      setPreview({ token: res.token, payee: res.payee, alias: res.alias, amount: res.amount, concept: res.concept, isOwn: res.isOwn })
    })
  }

  // Escaneo con la cámara, cuando el navegador lo soporta.
  useEffect(() => {
    if (!scanning) return
    let stop = false
    let stream: MediaStream | null = null
    ;(async () => {
      try {
        if (!window.BarcodeDetector) throw new Error('unsupported')
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const tick = async () => {
          if (stop) return
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) {
              setRaw(codes[0].rawValue)
              setScanning(false)
              load(codes[0].rawValue)
              return
            }
          } catch {
            /* frame sin código */
          }
          setTimeout(tick, 250)
        }
        tick()
      } catch {
        setScanning(false)
        setError('Tu navegador no puede escanear con la cámara. Pegá el enlace del QR o escanealo con la cámara del celular.')
      }
    })()
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [scanning])

  function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!preview) return
    setError(null)
    start(async () => {
      const res = await payQr({ token: preview.token, amount, attemptId })
      if (!res.ok) return setError(res.error)
      setDone({ reference: res.reference, payee: res.payee, amount: res.amount, balance: res.balance })
    })
  }

  if (done) {
    return (
      <Card className="p-6 sm:p-8">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Pago realizado</h2>
        <p className="mt-2 text-muted-foreground">
          Le pagaste <strong className="text-foreground">{formatMoney(done.amount)}</strong> a {done.payee}. Referencia{' '}
          <span className="tnum">{done.reference}</span>. Tu saldo ahora es {formatMoney(done.balance)}.
        </p>
        <Link href="/dashboard/billetera" className={buttonVariants({ className: 'mt-6' })}>
          Volver a mi billetera
        </Link>
      </Card>
    )
  }

  return (
    <Card className="p-5 sm:p-6">
      {!canSend ? (
        <Alert variant="warning" className="mb-5">
          Para pagar necesitás{' '}
          <Link href="/dashboard/perfil/identidad" className="font-semibold underline">
            verificar tu identidad
          </Link>
          .
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive" className="mb-5">{error}</Alert> : null}

      {!preview ? (
        <div className="flex flex-col gap-5">
          {scanning ? (
            <div className="relative overflow-hidden rounded-xl border bg-black">
              <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
              <Button variant="secondary" size="icon" className="absolute right-2 top-2" onClick={() => setScanning(false)} aria-label="Cerrar cámara">
                <X />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="lg" className="self-start" onClick={() => setScanning(true)}>
              <ScanLine />
              Escanear con la cámara
            </Button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              load(raw)
            }}
            className="flex flex-col gap-4"
          >
            <Field id="qr-raw" label="O pegá el enlace o el código del QR">
              <Input id="qr-raw" value={raw} onChange={(e) => setRaw(e.target.value)} autoComplete="off" spellCheck={false} placeholder="https://… o UCQ1.…" />
            </Field>
            <Button type="submit" size="lg" disabled={pending || !raw.trim()} className="self-start">
              {pending ? 'Leyendo…' : 'Continuar'}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={pay} className="flex flex-col gap-5">
          <div className="rounded-xl border bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vas a pagarle a</p>
            <p className="mt-1 text-lg font-semibold">{preview.payee}</p>
            <p className="tnum text-sm text-muted-foreground">@{preview.alias}</p>
            {preview.concept ? <p className="mt-2 text-sm">Concepto: {preview.concept}</p> : null}
          </div>
          {preview.isOwn ? <Alert variant="warning">Este QR es de tu propia billetera: no podés pagártelo.</Alert> : null}
          {preview.amount ? (
            <p className="text-3xl font-semibold tracking-tight">{formatMoney(preview.amount)}</p>
          ) : (
            <Field id="pay-amount" label="Importe" hint={`Disponible: ${formatMoney(balance)}`}>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0,00" className="tnum" aria-describedby="pay-amount-hint" />
            </Field>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={pending || !canSend || preview.isOwn || (!preview.amount && !amount.trim())}>
              {pending ? 'Pagando…' : 'Confirmar pago'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                setPreview(null)
                setAttemptId(crypto.randomUUID())
              }}
            >
              Cambiar QR
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
