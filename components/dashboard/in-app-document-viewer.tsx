'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { useCallback, useRef } from 'react'

export function InAppDocumentViewer({
  src,
  title,
}: {
  src: string
  title: string
}) {
  const frame = useRef<HTMLIFrameElement>(null)

  const printDoc = useCallback(() => {
    const win = frame.current?.contentWindow
    if (win) {
      win.focus()
      win.print()
      return
    }
    window.print()
  }, [])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-navy-900">{title}</p>
        <Button type="button" size="sm" className="gap-1.5" onClick={printDoc}>
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>
      <iframe
        ref={frame}
        src={src}
        title={title}
        className="block h-[min(78vh,900px)] w-full bg-white"
      />
    </div>
  )
}
