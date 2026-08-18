'use client'

import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })

    setLoading(false)

    if (error) {
      setError(
        isSignUp
          ? 'No pudimos crear tu cuenta. Verificá los datos e intentá de nuevo.'
          : 'Email o contraseña incorrectos.',
      )
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Panel lateral de marca */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <Logo invert />
        <div className="space-y-4">
          <h2 className="text-balance text-3xl font-bold leading-tight text-sidebar-foreground">
            Tu crédito, en minutos y 100% online.
          </h2>
          <p className="max-w-sm text-pretty text-sidebar-foreground/70">
            Evaluamos tu solicitud con datos del Banco Central de la República Argentina y te
            damos una respuesta al instante. Transparencia total en cada cuota.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          UniCred es una unidad de negocio de Unipagos S.A. — Argentina
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm border-border p-6">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isSignUp ? 'Creá tu cuenta' : 'Ingresá a tu cuenta'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp
                ? 'Empezá a solicitar tu crédito hoy.'
                : 'Accedé a tus créditos y cuotas.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nombre y apellido</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Juan Pérez"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="vos@email.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Procesando...' : isSignUp ? 'Crear cuenta' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
            <Link
              href={isSignUp ? '/sign-in' : '/sign-up'}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? 'Ingresá' : 'Registrate'}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
