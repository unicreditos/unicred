'use client'

import { Printer } from 'lucide-react'

export function PrintDocButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex h-10 items-center gap-2 rounded-full bg-brand-navy-900 px-5 text-sm font-semibold text-white hover:bg-brand-primary"
    >
      <Printer className="h-4 w-4" aria-hidden /> Imprimir o guardar PDF
    </button>
  )
}
