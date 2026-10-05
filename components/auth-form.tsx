'use client'

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
  'h-12 rounded-xl border-brand-navy-200 bg-white px-3.5 text-base text-brand-navy-900 placeholder:text-brand-navy-400'

export function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl') || searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await authClient.signIn.email({ email, password, rememberMe })

    setLoading(false)

    if (error) {
      const raw = `${error.message || ''} ${error.code || ''}`.toLowerCase()
      setError(
        raw.includes('verif') || raw.includes('email_not_verified')
          ? 'Tu email todavía no está verificado. Revisá tu correo o pedí un nuevo enlace.'
          : 'El email o la contraseña no coinciden. Revisalos e intentá de nuevo.',
      )
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
    <AuthFloatLayout headline="Ingresá a tu cuenta" lede="Mirá tus créditos, cuotas y documentos.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-brand-navy-800">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" className="text-brand-navy-800">
              Contraseña
            </Label>
            <Link
              href="/recuperar-clave"
              className="text-sm font-medium text-brand-primary-700 hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
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

        <label className="flex items-center gap-2 text-sm text-brand-navy-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-brand-navy-300 accent-brand-primary"
          />
          Mantener la sesión en este dispositivo
        </label>

        {error ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={loading} size="lg" className="h-12 rounded-full text-base font-semibold">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </Button>

        <p className="text-center text-sm text-brand-navy-600">
          ¿Todavía no tenés cuenta?{' '}
          <Link href="/sign-up" className="font-semibold text-brand-primary-700 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>
    </AuthFloatLayout>
  )
}
