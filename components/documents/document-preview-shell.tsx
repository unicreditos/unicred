'use client'

import { DocumentPrintTitle, PrintButton } from '@/components/documents/print-button'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ReactNode } from 'react'

export function DocumentPreviewShell({
  backHref,
  meta,
  fileName,
  extra,
  children,
}: {
  backHref: string
  meta: string
  /** Nombre al guardar PDF (sin .pdf). */
  fileName: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="document-preview-root">
      <DocumentPrintTitle fileName={fileName} />
      <div className="no-print document-preview-toolbar">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{meta}</p>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            Vista previa A4. En el diálogo de impresión usá «Guardar como PDF» — el archivo se
            nombrará según este documento.
          </p>
        </div>
        {extra}
        <PrintButton fileName={fileName} />
      </div>
      <div className="document-preview-canvas">{children}</div>
    </div>
  )
}
