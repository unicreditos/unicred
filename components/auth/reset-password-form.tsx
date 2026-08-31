'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <AuthShell
        title="Enlace inválido"
        description="El enlace para restablecer la contraseña venció o ya se usó."
        footer={
          <Link
            href="/recuperar-clave"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Pedir un enlace nuevo
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Por seguridad, cada enlace sirve una sola vez y vence al cabo de 1 hora.
        </p>
      </AuthShell>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: resetError } = await authClient.resetPassword({ token, newPassword: password })
    setLoading(false)

    if (resetError) {
      setError('No pudimos actualizar la contraseña. Pedí un enlace nuevo e intentá otra vez.')
      return
    }
    router.push('/sign-in?reset=ok')
  }

  return (
    <AuthShell
      title="Elegí una nueva contraseña"
      description="Va a reemplazar la anterior en todos tus dispositivos."
      footer={
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Volver al ingreso
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="h-12 rounded-lg border-slate-200 px-3.5"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation">Repetí la contraseña</Label>
          <Input
            id="confirmation"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="h-12 rounded-lg border-slate-200 px-3.5"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            asChild
            className="h-12 bg-[#F5A623] text-base font-semibold text-white hover:bg-[#e39614]"
          >
            <Link href="/sign-in">Volver</Link>
          </Button>
          <Button type="submit" disabled={loading} className="h-12 text-base font-semibold">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
