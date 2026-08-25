'use client'

import { Button } from '@/components/ui/button'
import { sanitizePdfFileName } from '@/lib/document-filename'
import { Printer } from 'lucide-react'
import { useEffect } from 'react'

/** Fija el título de la pestaña (nombre del PDF al guardar). */
export function DocumentPrintTitle({ fileName }: { fileName: string }) {
  useEffect(() => {
    const prev = document.title
    document.title = sanitizePdfFileName(fileName)
    return () => {
      document.title = prev
    }
  }, [fileName])
  return null
}

export function PrintButton({
  label = 'Imprimir / Guardar PDF',
  fileName,
}: {
  label?: string
  /** Nombre sugerido del PDF (sin .pdf). */
  fileName?: string
}) {
  function handlePrint() {
    const prev = document.title
    if (fileName) {
      document.title = sanitizePdfFileName(fileName)
    }

    let restored = false
    const restore = () => {
      if (restored) return
      restored = true
      document.title = prev
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.setTimeout(restore, 90_000)
    window.print()
  }

  return (
    <Button size="sm" className="gap-1.5 no-print" onClick={handlePrint}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  )
}
