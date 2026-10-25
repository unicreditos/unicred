'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { SecondFactorForm } from '@/components/auth/second-factor-form'

function safeCallbackUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

const fieldClass =
  'h-12 rounded-xl border-slate-200 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-primary-600 focus-visible:border-transparent transition'

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
  // Segundo factor DENTRO del ingreso: se muestra aca mismo antes de llegar a cualquier pantalla protegida.
  const [challenge, setChallenge] = useState<{ endpoint: string; totpEnabled: boolean; next: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) {
      setLoading(false)
      setError('Ingresá tu correo electrónico y contraseña para continuar.')
      return
    }

    let signInError: { message?: string; code?: string; status?: number } | null = null
    try {
      const res = await authClient.signIn.email({ email: cleanEmail, password, rememberMe })
      signInError = res.error ?? null
    } catch {
      setLoading(false)
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
      return
    }

    if (signInError) {
      setLoading(false)
      const raw = `${signInError.message || ''} ${signInError.code || ''}`.toLowerCase()
      setError(
        signInError.status === 429 || raw.includes('too many') || raw.includes('rate')
          ? 'Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.'
          : raw.includes('verif') || raw.includes('email_not_verified')
            ? 'Tu correo todavía no está verificado. Revisá tu bandeja de entrada o solicitá un nuevo enlace.'
            : 'El correo electrónico o la contraseña ingresada no coinciden. Revisá los datos e intentá nuevamente.',
      )
      return
    }

    let target = callbackUrl
    if (!target) {
      const res = await fetch('/api/me/dashboard-url', { cache: 'no-store' })
        .then((r) => r.json().catch(() => ({ dashboardUrl: '/dashboard' })))
        .catch(() => ({ dashboardUrl: '/dashboard' }))
      target = res.dashboardUrl || '/dashboard'
    }
    // Si el servidor exige segundo factor para esta sesion, se pide ahora. El servidor igual lo hace cumplir en cada pantalla protegida.
    const st = await fetch('/api/2fa/status', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    if (st?.ok && st.required && !st.passed) {
      setLoading(false)
      setChallenge({ endpoint: st.endpoint, totpEnabled: !!st.totpEnabled, next: target as string })
      return
    }
    router.push(target as string)
    router.refresh()
  }

  if (challenge) {
    return (
      <AuthFloatLayout headline="Verificación en dos pasos" lede="Un paso más para proteger tu cuenta.">
        <SecondFactorForm endpoint={challenge.endpoint} next={challenge.next} totpEnabled={challenge.totpEnabled} />
      </AuthFloatLayout>
    )
  }

  return (
    <AuthFloatLayout
      headline="Ingresá a tu cuenta"
      lede="Accedé a tus créditos vigentes, historial de cuotas, simulador y comprobantes oficiales."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-slate-800 font-medium">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              className={cn(fieldClass, 'pl-10')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" className="text-slate-800 font-medium">
              Contraseña
            </Label>
            <Link
              href="/recuperar-clave"
              className="text-xs font-semibold text-brand-primary-700 hover:text-brand-primary-800 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="Tu contraseña"
              className={cn(fieldClass, 'pl-10 pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-primary"
            />
            Mantener la sesión iniciada
          </label>
        </div>

        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-800 leading-snug"
            role="alert"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="h-12 w-full rounded-xl bg-brand-primary text-base font-bold text-white hover:bg-brand-primary-600 shadow-md shadow-brand-primary-700/20 transition active:scale-[0.99]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando datos…
            </span>
          ) : (
            'Ingresar a mi cuenta'
          )}
        </Button>

        <p className="text-center text-sm text-slate-600">
          ¿Todavía no tenés cuenta?{' '}
          <Link href="/sign-up" className="font-bold text-brand-primary-700 hover:underline">
            Crear mi cuenta gratis
          </Link>
        </p>
      </form>
    </AuthFloatLayout>
  )
}
