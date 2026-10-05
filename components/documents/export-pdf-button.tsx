'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sanitizePdfFileName } from '@/lib/document-filename'
import { Download, Loader2 } from 'lucide-react'

export function ExportPdfButton({
  fileName,
  label = 'Exportar PDF',
  targetSelector = '.document-preview-canvas',
}: {
  fileName: string
  label?: string
  targetSelector?: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (loading) return
    try {
      setLoading(true)
      const targetElement = document.querySelector(targetSelector) as HTMLElement | null
      if (!targetElement) {
        console.warn('Contenedor de documento no encontrado:', targetSelector)
        return
      }

      const html2pdfModule = await import('html2pdf.js')
      // html2pdf.js can be exported as default or module function
      const html2pdf = (html2pdfModule as unknown as { default?: typeof html2pdfModule }).default || html2pdfModule

      const cleanBaseName = sanitizePdfFileName(fileName)
      const finalFileName = cleanBaseName.toLowerCase().endsWith('.pdf')
        ? cleanBaseName
        : `${cleanBaseName}.pdf`

      const opt = {
        margin: [4, 4, 4, 4],
        filename: finalFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait' as const,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }

      // @ts-expect-error html2pdf is a callable function returning chainable worker
      await html2pdf().set(opt).from(targetElement).save()
    } catch (err) {
      console.error('Error al exportar PDF con html2pdf:', err)
      // Fallback: update document title and trigger print dialog
      const prev = document.title
      if (fileName) {
        document.title = sanitizePdfFileName(fileName)
      }
      window.print()
      document.title = prev
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      id="export-pdf-button"
      type="button"
      size="sm"
      variant="default"
      className="gap-1.5 no-print font-medium shadow-xs"
      onClick={handleExport}
      disabled={loading}
      title={`Exportar ${sanitizePdfFileName(fileName)}.pdf`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Exportando PDF...</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          <span>{label}</span>
        </>
      )}
    </Button>
  )
}
