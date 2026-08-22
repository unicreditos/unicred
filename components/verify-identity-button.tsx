'use client'

import { useState } from 'react'
import { DiditSdk } from '@didit-protocol/sdk-web'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export function VerifyIdentityButton() {
  const [loading, setLoading] = useState(false)
  async function startVerification() {
    setLoading(true)
    try {
      const response = await fetch('/api/verify', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error ?? 'No se pudo iniciar la verificación')
      DiditSdk.shared.onComplete = () => undefined
      DiditSdk.shared.startVerification({ url: data.url })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar la verificación')
    } finally {
      setLoading(false)
    }
  }
  return <Button variant="outline" onClick={startVerification} disabled={loading}>
    <ShieldCheck className="mr-2 size-4" />
    {loading ? 'Preparando verificación…' : 'Verificar identidad'}
  </Button>
}
