'use client'

import { ExportPdfButton } from '@/components/documents/export-pdf-button'
import { DocumentPrintTitle, PrintButton } from '@/components/documents/print-button'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ReactNode, useEffect } from 'react'

export function DocumentPreviewShell({
  backHref,
  meta,
  fileName,
  extra,
  hint,
  children,
  embed = false,
  autoPrint = false,
}: {
  backHref: string
  meta: string
  fileName: string
  extra?: ReactNode
  hint?: string
  children: ReactNode
  /** Resuelto en el servidor desde ?embed=1 */
  embed?: boolean
  /** Resuelto en el servidor desde ?print=1 */
  autoPrint?: boolean
}) {
  useEffect(() => {
    if (!autoPrint || embed) return
    const timer = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(timer)
  }, [autoPrint, embed])

  return (
    <div className={embed ? 'document-preview-root is-embed' : 'document-preview-root'}>
      <DocumentPrintTitle fileName={fileName} />
      {embed ? null : (
        <div className="no-print document-preview-toolbar">
          <Button asChild variant="outline" size="sm" className="gap-1.5" id="btn-back-document">
            <Link href={backHref} prefetch={false}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{meta}</p>
            <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
              {hint ??
                'Vista previa A4. Podés exportar el documento directamente como archivo PDF o imprimirlo según tu preferencia.'}
            </p>
          </div>
          {extra}
          <ExportPdfButton fileName={fileName} />
          <PrintButton fileName={fileName} />
        </div>
      )}
      <div className="document-preview-canvas" id="document-preview-canvas">
        {children}
      </div>
    </div>
  )
}
