'use client'

import { PedirAppShell } from '@/components/pedir/app-shell'
import { PedirDocLinks } from '@/components/pedir/doc-links'
import { DocumentPrintTitle, PrintButton } from '@/components/documents/print-button'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PedirDocViewer({
  title,
  meta,
  fileName,
  contractId,
  loanId,
  children,
}: {
  title: string
  meta: string
  /** Nombre al guardar PDF (sin .pdf). */
  fileName: string
  contractId?: string | null
  loanId?: string | null
  children: ReactNode
}) {
  return (
    <PedirAppShell title={title} subtitle={meta}>
      <DocumentPrintTitle fileName={fileName} />
      <div className="lp-doc-viewer no-print">
        <div className="lp-doc-toolbar">
          <Link href="/pedir/cuenta" className="lp-btn lp-btn-ghost py-2 text-sm text-[var(--lp-ink)]">
            ← Inicio
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--lp-ink)]">{meta}</p>
            <p className="hidden text-[11px] text-[var(--lp-muted)] sm:block">
              Al guardar como PDF el archivo usa el nombre de este documento.
            </p>
          </div>
          <PedirDocLinks contractId={contractId} loanId={loanId} />
          <PrintButton fileName={fileName} />
        </div>
      </div>

      <div className="lp-doc-canvas">{children}</div>
    </PedirAppShell>
  )
}

export function PedirDocMissing({ title, hint }: { title: string; hint?: string }) {
  return (
    <PedirAppShell title={title} subtitle="Documento">
      <div className="lp-app-panel text-center">
        <h2 className="lp-display text-2xl text-[var(--lp-ink)]">{title}</h2>
        {hint ? <p className="mt-2 text-sm text-[var(--lp-muted)]">{hint}</p> : null}
        <Link href="/pedir/cuenta" className="lp-btn lp-btn-ink mt-6">
          Volver al inicio
        </Link>
      </div>
    </PedirAppShell>
  )
}
