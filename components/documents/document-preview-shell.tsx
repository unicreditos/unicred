'use client'

import { DocumentPrintTitle, PrintButton } from '@/components/documents/print-button'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ReactNode, Suspense } from 'react'

export function DocumentPreviewShell(props: {
  backHref: string
  meta: string
  fileName: string
  extra?: ReactNode
  hint?: string
  children: ReactNode
}) {
  return (
    <Suspense fallback={<div className="document-preview-root">{props.children}</div>}>
      <DocumentPreviewShellInner {...props} />
    </Suspense>
  )
}

function DocumentPreviewShellInner({
  backHref,
  meta,
  fileName,
  extra,
  hint,
  children,
}: {
  backHref: string
  meta: string
  fileName: string
  extra?: ReactNode
  hint?: string
  children: ReactNode
}) {
  const embed = useSearchParams().get('embed') === '1'

  return (
    <div className={embed ? 'document-preview-root is-embed' : 'document-preview-root'}>
      <DocumentPrintTitle fileName={fileName} />
      {embed ? null : (
        <div className="no-print document-preview-toolbar">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{meta}</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              {hint ??
                'Vista previa A4. En el diálogo de impresión usá «Guardar como PDF» — el archivo se nombrará según este documento.'}
            </p>
          </div>
          {extra}
          <PrintButton fileName={fileName} />
        </div>
      )}
      <div className="document-preview-canvas">{children}</div>
    </div>
  )
}
