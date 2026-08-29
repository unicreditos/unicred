'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'unicred_cookie_consent_v1'

type Consent = 'accepted' | 'essential'

function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === 'accepted' || value === 'essential') return value
  } catch {
    /* private mode */
  }
  return null
}

function subscribe(onStoreChange: () => void) {
  const onStorage = () => onStoreChange()
  const onConsent = () => onStoreChange()
  window.addEventListener('storage', onStorage)
  window.addEventListener('unicred:cookie-consent', onConsent as EventListener)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('unicred:cookie-consent', onConsent as EventListener)
  }
}

function getSnapshot(): Consent | 'pending' {
  return readConsent() ?? 'pending'
}

function getServerSnapshot(): Consent | 'pending' {
  return 'accepted'
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (consent !== 'pending') return null

  function save(value: Consent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore quota / private mode */
    }
    window.dispatchEvent(new CustomEvent('unicred:cookie-consent', { detail: value }))
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:p-5"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p id="cookie-consent-title" className="text-sm font-bold text-brand-navy">
            Cookies y privacidad
          </p>
          <p id="cookie-consent-desc" className="text-sm leading-relaxed text-muted-foreground">
            Usamos cookies técnicas de sesión para que la plataforma funcione. Si aceptás, también
            habilitamos analítica de Vercel para medir el uso del sitio. Detalle en la{' '}
            <Link href="/legal/privacidad" className="font-semibold text-brand-primary underline-offset-2 hover:underline">
              Política de privacidad
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save('essential')}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Solo esenciales
          </button>
          <button
            type="button"
            onClick={() => save('accepted')}
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand-primary/20 transition hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
