'use client'

import { Analytics } from '@vercel/analytics/next'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'unicred_cookie_consent_v1'

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

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

function getServerSnapshot() {
  return false
}

export function AnalyticsGate() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (process.env.NODE_ENV !== 'production' || !enabled) return null
  return <Analytics />
}
