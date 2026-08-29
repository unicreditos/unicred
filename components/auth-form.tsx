'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { BRAND } from '@/lib/brand'
import { authClient } from '@/lib/auth-client'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

/** Solo se acepta un destino interno para que el callback no sirva de redirect abierto. */
function safeCallbackUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl') || searchParams.get('next'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password, rememberMe })

    setLoading(false)

    if (error) {
      const raw = `${error.message || ''} ${error.code || ''}`.toLowerCase()
      if (!isSignUp && (raw.includes('verif') || raw.includes('email_not_verified'))) {
        setError('Tu email todavía no está verificado. Revisá tu correo o pedí un nuevo enlace.')
      } else {
        setError(
          isSignUp
            ? 'No pudimos crear tu cuenta. Verificá los datos e intentá de nuevo.'
            : 'Email o contraseña incorrectos.',
        )
      }
      return
    }

    if (callbackUrl) {
      router.push(callbackUrl)
      router.refresh()
      return
    }

    const res = await fetch('/api/me/dashboard-url', {
      cache: 'no-store',
    }).then((r) => r.json().catch(() => ({ dashboardUrl: '/dashboard' })))
    router.push(res.dashboardUrl || '/dashboard')
    router.refresh()
  }

  return (
    <main className="relative grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0C1612] p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(180deg, transparent 42%, rgba(7,16,12,0.85) 100%), radial-gradient(ellipse at 50% 110%, #20BD5A 0%, transparent 55%)',
          }}
        />
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-black/35"
          viewBox="0 0 1200 180"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M0 180V110h40v-40h18v40h22V70h28v40h16V90h20v90H0zM180 180V85h24v-28h16v28h20V60h30v28h18v92H180zM360 180V95h20V55h22v40h18V80h26v100H360zM520 180V70h18V40h22v30h16V58h28v30h20v92H520zM700 180V88h22V48h18v40h24V72h30v108H700zM900 180V100h16V62h20v38h18V78h26v102H900zM1040 180V82h20V50h24v32h18V68h28v112h70V180H1040z"
          />
        </svg>
        <BrandLogo showText light />
        <div className="relative z-10 max-w-md space-y-4">
          <p className="text-sm font-medium text-brand-cian-200">
            {BRAND.slogan}
          </p>
          <h2 className="text-balance text-3xl font-bold leading-tight text-white">
            {BRAND.valueProp}
          </h2>
          <p className="text-sm font-medium text-white/80">{BRAND.tagline}</p>
          <p className="max-w-sm text-pretty text-slate-300/85">
            Evaluamos tu solicitud con la Central de Deudores del BCRA y te mostramos TNA y CFT
            antes de firmar. El tiempo de respuesta depende de Didit y de la consulta oficial.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/45">
          UNICRÉDITOS es la unidad de créditos de Grupo Emprenor, operada por {BRAND.legalName} — {BRAND.domain}
        </p>
      </div>

      <div className="flex items-center justify-center bg-[#F5F7FA] px-4 py-10">
        <Card className="w-full max-w-sm rounded-2xl border-slate-200 p-6 shadow-lg shadow-slate-200/70">
          <div className="mb-6 lg:hidden">
            <BrandLogo showText />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isSignUp ? 'Creá tu cuenta' : 'Iniciar sesión'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp
                ? 'Empezá a solicitar tu crédito hoy.'
                : 'Accedé a tus créditos, cuotas y comprobantes.'}
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
                  placeholder="Nombre y apellido"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
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
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="password">Contraseña</Label>
                {!isSignUp && (
                  <Link
                    href="/recuperar-clave"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isSignUp ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary"
                />
                Recordarme
              </label>
            ) : null}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full font-semibold">
              {loading ? 'Procesando...' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
            <Link
              href={isSignUp ? '/sign-in' : '/sign-up'}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? 'Iniciar sesión' : 'Registrate'}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
