'use client'

import { Button } from '@/components/ui/button'
import { AlertOctagon, RotateCcw } from 'lucide-react'
import './globals.css'

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="es-AR" className="bg-background">
      <body className="font-sans antialiased">
        <title>Error — UNICRÉDITOS</title>
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16 sm:px-6">
          <div className="w-full max-w-xl rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertOctagon className="h-5 w-5" />
            </span>

            <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
              UNICRÉDITOS no está disponible en este momento
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Se produjo un error inesperado y no pudimos mostrar el sitio. Ninguna operación quedó a
              medias: tus créditos y tus pagos no se ven afectados. Reintentá en unos segundos.
            </p>

            {error.digest && (
              <div className="mt-5 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Código de referencia
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{error.digest}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" className="font-bold" onClick={() => retry()}>
                <RotateCcw className="h-4 w-4" /> Reintentar
              </Button>
              {/* global-error reemplaza el layout raíz: el router de Next puede
                  no estar montado, así que la navegación tiene que ser nativa. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
