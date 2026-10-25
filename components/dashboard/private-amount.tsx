'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const KEY = 'uc:ocultar-saldo'
const EVENT = 'uc-ocultar-saldo'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

function read() {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Estado "ocultar saldo" compartido por todos los importes de la pantalla (y recordado en este navegador). */
function useHidden() {
  return useSyncExternalStore(subscribe, read, () => false)
}

/** Importe que se reemplaza por puntos cuando la persona oculta su saldo (privacidad en lugares públicos). */
export function PrivateText({ text, className }: { text: string; className?: string }) {
  const hidden = useHidden()
  return (
    <span className={className} aria-label={hidden ? 'Importe oculto' : undefined}>
      {hidden ? '$ ••••••' : text}
    </span>
  )
}

export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = useHidden()
  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
      title={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
      onClick={() => {
        try {
          window.localStorage.setItem(KEY, hidden ? '0' : '1')
        } catch {
          /* sin almacenamiento: se oculta solo hasta recargar */
        }
        window.dispatchEvent(new Event(EVENT))
      }}
      className={cn('inline-flex size-8 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white', className)}
    >
      {hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </button>
  )
}
