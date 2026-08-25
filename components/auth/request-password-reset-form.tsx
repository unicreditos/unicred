'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export function RequestPasswordResetForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/restablecer-clave',
    })

    setLoading(false)
    if (resetError) {
      setError('No pudimos procesar el pedido. Intentá de nuevo en unos minutos.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        title="Revisá tu correo"
        description="Si el email corresponde a una cuenta de UNICRÉDITOS, vas a recibir un enlace para elegir una nueva contraseña."
        footer={
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            Volver al ingreso
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            El enlace vence en 1 hora y se puede usar una sola vez. Si no lo encontrás, revisá la
            carpeta de correo no deseado.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Ingresá el email de tu cuenta y te mandamos un enlace para restablecerla."
      footer={
        <>
          ¿La recordaste?{' '}
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            Ingresá
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="vos@email.com"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Enviando…' : 'Enviarme el enlace'}
        </Button>
      </form>
    </AuthShell>
  )
}
