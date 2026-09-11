'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Para acciones irreversibles (borrar, anular) — pinta el botón en rojo. */
  destructive?: boolean
}

/**
 * Reemplazo de window.confirm() para acciones administrativas. El diálogo
 * nativo del navegador no se puede estilizar y desentona con el resto del
 * panel; esto además evita que un click accidental dispare de una la acción
 * (el confirm nativo a veces se cierra solo con Enter apurado).
 */
export function useConfirmDialog() {
  const [state, setState] = useState<(ConfirmOptions & { onConfirm: () => void }) | null>(null)

  const confirm = useCallback((options: ConfirmOptions, onConfirm: () => void) => {
    setState({ ...options, onConfirm })
  }, [])

  const confirmDialog = (
    <Dialog open={!!state} onOpenChange={(open: boolean) => !open && setState(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          {state?.description ? <DialogDescription>{state.description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState(null)}>
            {state?.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={state?.destructive ? 'destructive' : 'default'}
            onClick={() => {
              state?.onConfirm()
              setState(null)
            }}
          >
            {state?.confirmLabel ?? 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, confirmDialog }
}
