import { Logo } from '@/components/brand'
import { LoanSimulator } from '@/components/loan-simulator'
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/session'
import {
  BadgeCheck,
  Building2,
  Clock,
  ShieldCheck,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'

export default async function HomePage() {
  const session = await getSession()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#productos" className="hover:text-foreground">Créditos</a>
            <a href="#comercios" className="hover:text-foreground">Comercios</a>
            <a href="#como-funciona" className="hover:text-foreground">Cómo funciona</a>
          </nav>
          <div className="flex items-center gap-2">
            {session?.user ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Mi cuenta</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Ingresar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/sign-up">Crear cuenta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Evaluación con datos del BCRA
            </span>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Créditos y préstamos online, en cuotas fijas y sin vueltas.
            </h1>
            <p className="max-w-lg text-pretty text-lg text-muted-foreground">
              UniCred te presta hasta $3.000.000 con aprobación al instante. Simulá tu cuota,
              solicitá 100% online y recibí el dinero en tu cuenta. Para personas y comercios de
              toda la Argentina.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Solicitar mi crédito</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#comercios">Soy un comercio</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 pt-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Respuesta en minutos
              </span>
              <span className="inline-flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" /> Sin costos ocultos
              </span>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <LoanSimulator />
          </div>
        </div>
      </section>

      {/* Productos */}
      <section id="productos" className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Nuestros créditos</h2>
        <p className="mt-1 text-muted-foreground">Elegí el producto que mejor se adapta a vos.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              name: 'Préstamo Personal',
              desc: 'Hasta $3.000.000 en hasta 48 cuotas fijas para lo que necesites.',
              rate: 'TNA desde 90%',
            },
            {
              icon: TrendingUp,
              name: 'Crédito de Consumo',
              desc: 'Financiá tus compras en cuotas con acreditación inmediata.',
              rate: 'Hasta 24 cuotas',
            },
            {
              icon: Clock,
              name: 'RapiCuotas Express',
              desc: 'Montos chicos, aprobación en segundos y sin papeles.',
              rate: 'Desde $10.000',
            },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <p className="mt-4 text-sm font-medium text-primary">{p.rate}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-y border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Cómo funciona</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              { n: '1', t: 'Simulá y solicitá', d: 'Elegí monto y cuotas, completá tus datos y enviá la solicitud online.' },
              { n: '2', t: 'Evaluamos con el BCRA', d: 'Consultamos la Central de Deudores del Banco Central y calculamos tu score al instante.' },
              { n: '3', t: 'Recibí el dinero', d: 'Si sos aprobado, acreditamos el crédito y ves tu plan de cuotas en el panel.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comercios */}
      <section id="comercios" className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 rounded-2xl border border-border bg-card p-8 lg:grid-cols-2 lg:p-12">
          <div className="space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Store className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">
              Vendé más con financiación propia
            </h2>
            <p className="text-muted-foreground">
              Sumá tu comercio a UniCred y ofrecé cuotas a tus clientes en el acto. Nosotros
              ponemos la financiación y la evaluación crediticia; vos vendés y cobrás.
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              {[
                'Alta de ventas en cuotas en segundos',
                'Liquidaciones y comisiones transparentes',
                'Panel de gestión de clientes y cobranzas',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button asChild>
              <Link href="/sign-up">
                <Building2 className="mr-1 h-4 w-4" /> Registrar mi comercio
              </Link>
            </Button>
          </div>
          <div className="rounded-xl bg-sidebar p-8 text-sidebar-foreground">
            <p className="text-sm text-sidebar-foreground/70">Ejemplo de liquidación</p>
            <p className="mt-2 font-mono text-3xl font-bold">$250.000</p>
            <p className="text-sm text-sidebar-foreground/60">venta en 6 cuotas</p>
            <div className="mt-6 space-y-2 border-t border-sidebar-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-sidebar-foreground/70">Comisión UniCred (8%)</span>
                <span className="font-mono">-$20.000</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Recibís</span>
                <span className="font-mono text-sidebar-primary">$230.000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div className="max-w-sm space-y-3">
              <Logo />
              <p className="text-sm text-muted-foreground">
                UniCred es una unidad de negocio de Unipagos S.A. Créditos sujetos a aprobación
                crediticia. TNA, CFT e impuestos informados en cada operación.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Legales</p>
              <p className="mt-2 max-w-xs text-pretty">
                Evaluación crediticia realizada con información pública de la Central de Deudores
                del Banco Central de la República Argentina (BCRA).
              </p>
            </div>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            © {new Date().getFullYear()} UniCred — Unipagos S.A. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
