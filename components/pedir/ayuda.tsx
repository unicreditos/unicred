'use client'

import { PedirAppShell } from '@/components/pedir/app-shell'
import { PedirContactAppBody } from '@/components/pedir/contact-form'

export function PedirAyudaClient() {
  return (
    <PedirAppShell title="Ayuda" subtitle="Soporte del canal de préstamos">
      <PedirContactAppBody />
    </PedirAppShell>
  )
}
