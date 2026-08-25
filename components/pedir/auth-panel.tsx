'use client'

import { PedirAppFrame } from '@/components/pedir/app-shell'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

function safeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/pedir/cuenta'
  if (!value.startsWith('/pedir')) return '/pedir/cuenta'
  return value
}

export function PedirAuthPanel({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = safeCallbackUrl(search.get('callbackUrl'))
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>(mode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res =
      authMode === 'sign-up'
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password, rememberMe: true })
    setLoading(false)
    if (res.error) {
      setError(
        authMode === 'sign-up'
          ? 'No pudimos crear la cuenta. Revisá el email o probá otro.'
          : 'Email o contraseña incorrectos.',
      )
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <PedirAppFrame backHref="/pedir">
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">Acceso a la app</p>
        <h1 className="lp-display mt-2 text-3xl text-[var(--lp-ink)] sm:text-4xl">
          {authMode === 'sign-up' ? 'Creá tu cuenta' : 'Ingresá'}
        </h1>
        <p className="mt-2 text-sm text-[var(--lp-muted)]">Una sola cuenta para pedir, firmar y pagar.</p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className={`lp-btn flex-1 py-2 text-sm ${authMode === 'sign-up' ? 'lp-btn-ink' : 'lp-btn-ghost text-[var(--lp-ink)]'}`}
            onClick={() => setAuthMode('sign-up')}
          >
            Crear cuenta
          </button>
          <button
            type="button"
            className={`lp-btn flex-1 py-2 text-sm ${authMode === 'sign-in' ? 'lp-btn-ink' : 'lp-btn-ghost text-[var(--lp-ink)]'}`}
            onClick={() => setAuthMode('sign-in')}
          >
            Ingresar
          </button>
        </div>

        {error ? <div className="lp-alert lp-alert-err mt-6">{error}</div> : null}

        <form onSubmit={onSubmit} className="lp-app-panel mt-6 space-y-4">
          {authMode === 'sign-up' ? (
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-auth-name">
                Nombre completo
              </label>
              <input
                id="lp-auth-name"
                className="lp-input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-auth-email">
              Email
            </label>
            <input
              id="lp-auth-email"
              type="email"
              className="lp-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-auth-pass">
              Contraseña
            </label>
            <input
              id="lp-auth-pass"
              type="password"
              minLength={8}
              className="lp-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
            />
          </div>
          <button type="submit" className="lp-btn lp-btn-primary w-full" disabled={loading}>
            {loading ? 'Procesando…' : authMode === 'sign-up' ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--lp-muted)]">
          <Link href="/pedir/solicitud" className="font-semibold text-[var(--lp-mint-deep)] underline">
            Ir a la solicitud
          </Link>
        </p>
      </div>
    </PedirAppFrame>
  )
}
