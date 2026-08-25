import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Calculator, Home, LifeBuoy, MapPinOff, Store } from 'lucide-react'
import Link from 'next/link'

const shortcuts = [
  {
    icon: Calculator,
    title: 'Simulá tu crédito',
    description: 'Elegí monto y plazo, y mirá cuota, TNA y CFT antes de solicitar.',
    href: '/simulador',
  },
  {
    icon: Store,
    title: 'Red de comercios',
    description: 'Financiá compras en comercios adheridos, sin tarjeta.',
    href: '/comercios',
  },
  {
    icon: LifeBuoy,
    title: 'Contacto',
    description: 'Escribinos por formulario o email de soporte.',
    href: '/contacto',
  },
]

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16 sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <MapPinOff className="h-3.5 w-3.5" /> Error 404
          </span>
          <p className="mt-6 font-mono text-6xl font-black tracking-tight text-primary tabular-nums sm:text-7xl">
            404
          </p>
          <h1 className="mt-3 text-balance text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            No encontramos esta página
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Puede que el enlace haya cambiado o que la dirección esté mal escrita. Volvé al inicio o
            seguí con alguno de estos accesos.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="font-bold">
              <Link href="/">
                <Home className="h-4 w-4" /> Volver al inicio
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-semibold">
              <Link href="/contacto">Hablar con soporte</Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon
            return (
              <Card key={shortcut.href} className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="text-sm font-bold text-foreground">{shortcut.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {shortcut.description}
                  </p>
                  <Link
                    href={shortcut.href}
                    className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary hover:underline"
                  >
                    Ir ahora <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}
