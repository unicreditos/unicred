'use client'

import { AuthAlert } from '@/components/auth/auth-shell'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

/** Solo se acepta un destino interno para que el callback no sirva de redirect abierto. */
function safeCallbackUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

const fieldClass =
  'h-12 rounded-xl border-brand-navy-200 bg-white px-3.5 text-sm text-brand-navy-900 placeholder:text-brand-navy-400'

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
    <AuthFloatLayout
      headline={isSignUp ? 'Creá tu cuenta' : 'Bienvenido de nuevo'}
      lede={
        isSignUp
          ? 'El alta completo está en el registro guiado.'
          : 'Accedé a tu panel, cuotas y documentación.'
      }
    >
      {!isSignUp ? null : (
        <p className="mb-6 rounded-xl border border-brand-navy-200 bg-brand-navy-50 px-4 py-3 text-sm text-brand-navy-700">
          Para personas y comercios usá el{' '}
          <Link href="/sign-up" className="font-semibold text-brand-primary underline">
            registro guiado
          </Link>{' '}
          (DNI/CUIL → contacto → clave → Didit).
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-brand-navy-800">
              Nombre y apellido
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Nombre y apellido"
              className={fieldClass}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-brand-navy-800">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
              className={cn(fieldClass, 'pl-10')}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-brand-navy-800">
            Contraseña
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="Tu contraseña"
              className={cn(fieldClass, 'pl-10 pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brand-navy-400 hover:text-brand-navy-700"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isSignUp ? (
          <label className="flex items-center gap-2 text-sm text-brand-navy-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-brand-navy-300 text-primary"
            />
            Recordarme en este dispositivo
          </label>
        ) : null}

        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <p className="pt-1 text-center text-sm text-brand-navy-600">
          {isSignUp ? (
            <Link href="/sign-in" className="font-medium hover:text-brand-navy-900 hover:underline">
              ¿Ya tenés cuenta?
            </Link>
          ) : (
            <>
              <Link href="/recuperar-clave" className="font-medium hover:text-brand-navy-900 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
              <span className="mx-2 text-brand-navy-300">|</span>
              <Link href="/sign-up" className="font-medium hover:text-brand-navy-900 hover:underline">
                Crear cuenta
              </Link>
            </>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button type="button" asChild variant="outline" className="h-12 text-base font-semibold">
            <Link href={isSignUp ? '/sign-in' : '/'}>Volver</Link>
          </Button>
          <Button type="submit" disabled={loading} className="h-12 text-base font-semibold">
            {loading ? 'Procesando...' : isSignUp ? 'Crear cuenta' : 'Ingresar'}
          </Button>
        </div>
      </form>
    </AuthFloatLayout>
  )
}
