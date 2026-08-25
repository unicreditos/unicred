'use client'

import { useEffect } from 'react'

/** Avisa al padre si Didit redirige el iframe al callback de UniCred. */
export function DiditEmbedReturn({ status }: { status: string }) {
  useEffect(() => {
    if (window.parent === window) return
    window.parent.postMessage({ type: 'didit:unicred-return', status }, window.location.origin)
  }, [status])
  return null
}
