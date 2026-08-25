'use client'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { KeyRound, Loader2, Shield } from 'lucide-react'
import { useState } from 'react'

export function AccountSettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard
        title="Contraseña"
        description="Cambio de clave de acceso. Las demás sesiones se cierran."
        icon={<KeyRound className="h-4 w-4 text-brand-primary" />}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setMsg(null)
            if (newPassword.length < 8) {
              setMsg({ type: 'err', text: 'La nueva clave debe tener al menos 8 caracteres.' })
              return
            }
            if (newPassword !== confirm) {
              setMsg({ type: 'err', text: 'Las claves no coinciden.' })
              return
            }
            setPending(true)
            try {
              const { error } = await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
              })
              if (error) {
                setMsg({ type: 'err', text: error.message || 'No se pudo cambiar la clave.' })
              } else {
                setCurrentPassword('')
                setNewPassword('')
                setConfirm('')
                setMsg({ type: 'ok', text: 'Clave actualizada. Las otras sesiones quedaron cerradas.' })
              }
            } catch (err) {
              setMsg({
                type: 'err',
                text: err instanceof Error ? err.message : 'No se pudo cambiar la clave.',
              })
            } finally {
              setPending(false)
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-pass">Clave actual</Label>
            <Input
              id="current-pass"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Nueva clave</Label>
            <Input
              id="new-pass"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass">Repetir nueva clave</Label>
            <Input
              id="confirm-pass"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {msg ? (
            <p className={msg.type === 'ok' ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>
              {msg.text}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Actualizar clave
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Seguridad de la cuenta"
        description="Lo que UNICRÉDITOS no ofrece y lo que sí."
        icon={<Shield className="h-4 w-4 text-brand-primary" />}
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>La identidad se verifica solo con Didit. No hay carga manual de fotos.</li>
          <li>El débito automático CBU no está habilitado. Pagás cuota a cuota o cancelás el saldo.</li>
          <li>Los recibos no son factura electrónica AFIP. Son comprobantes de cobro de RM International Group S.A.S.</li>
          <li>No hay seguros de vida ni de desempleo asociados al crédito.</li>
          <li>El segundo factor (2FA) todavía no está publicado en este canal.</li>
        </ul>
      </SectionCard>
    </div>
  )
}
