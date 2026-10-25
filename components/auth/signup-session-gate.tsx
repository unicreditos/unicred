'use client'

import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Quien ya tiene sesión no puede abrir otra cuenta en la misma ventana. */
export function SignupSessionGate({ panelHref }: { panelHref: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function leave() {
    setBusy(true)
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace('/sign-up')
          router.refresh()
        },
        onError: () => setBusy(false),
      },
    })
  }

  return (
    <AuthFloatLayout
      headline="Ya hay una sesión abierta"
      lede="Para crear una cuenta nueva tenés que cerrar la sesión actual. Si no, el alta te devuelve al panel."
    >
      <div className="space-y-3">
        <Button type="button" className="h-12 w-full rounded-full text-base font-semibold" disabled={busy} onClick={leave}>
          {busy ? 'Cerrando sesión…' : 'Cerrar sesión y crear cuenta'}
        </Button>
        <Button asChild type="button" variant="outline" className="h-12 w-full rounded-full bg-white text-base font-semibold">
          <a href={panelHref}>Volver a mi panel</a>
        </Button>
      </div>
    </AuthFloatLayout>
  )
}
