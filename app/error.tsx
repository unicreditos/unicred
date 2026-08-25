'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Home, LifeBuoy, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16 sm:px-6">
      <Card className="w-full max-w-xl">
        <CardContent className="flex flex-col gap-5 py-2">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Algo falló
              </p>
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                No pudimos cargar esta sección
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Tuvimos un problema al procesar tu pedido. Tus datos y tus créditos no se vieron
            afectados. Probá de nuevo en unos segundos; si el error sigue, escribinos y lo revisamos.
          </p>

          {error.digest && (
            <div className="rounded-xl border border-border bg-muted/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Código de referencia
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{error.digest}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="font-bold" onClick={() => retry()}>
              <RotateCcw className="h-4 w-4" /> Reintentar
            </Button>
            <Button asChild size="lg" variant="outline" className="font-semibold">
              <Link href="/">
                <Home className="h-4 w-4" /> Ir al inicio
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="font-semibold">
              <Link href="/contacto">
                <LifeBuoy className="h-4 w-4" /> Soporte
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
