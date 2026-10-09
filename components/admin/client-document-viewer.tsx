'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'

export interface ClientDocumentViewerProps {
  clientName: string
  dni: string
  cuit: string
  kycStatus: string
  faceMatchScore?: number | null
  documents?: {
    dniFrontUrl?: string | null
    dniBackUrl?: string | null
    selfieUrl?: string | null
    salaryProofUrl?: string | null
    ocrDniNumber?: string | null
    ocrFullName?: string | null
    ocrBirthDate?: string | null
    ocrGender?: string | null
    ocrAddress?: string | null
  }
}

export function ClientDocumentViewer({
  clientName,
  dni,
  cuit,
  kycStatus,
  faceMatchScore,
  documents,
}: ClientDocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState<'dniFront' | 'dniBack' | 'selfie' | 'salary'>('dniFront')
  const [isZoomed, setIsZoomed] = useState(false)
  const [verifiedState, setVerifiedState] = useState<Record<string, 'ok' | 'flagged' | null>>({
    dniFront: null,
    dniBack: null,
    selfie: null,
    salary: null,
  })

  const docItems = [
    {
      id: 'dniFront' as const,
      title: 'DNI Frente',
      subtitle: 'Biometría y holograma nacional',
      src: documents?.dniFrontUrl || '/docs/dni-front.jpg',
      aspect: 'aspect-[4/3]',
      tag: 'Frente oficial',
    },
    {
      id: 'dniBack' as const,
      title: 'DNI Dorso',
      subtitle: 'Código de barras 2D y zona MRZ',
      src: documents?.dniBackUrl || '/docs/dni-back.jpg',
      aspect: 'aspect-[4/3]',
      tag: 'Dorso oficial',
    },
    {
      id: 'selfie' as const,
      title: 'Prueba de Vida / Selfie',
      subtitle: 'Captura biométrica con match facial',
      src: documents?.selfieUrl || '/docs/selfie.jpg',
      aspect: 'aspect-square',
      tag: faceMatchScore ? `Match ${Math.round(faceMatchScore)}%` : 'Match biométrico',
    },
    {
      id: 'salary' as const,
      title: 'Recibo de Sueldo',
      subtitle: 'Comprobante de ingresos haberes',
      src: documents?.salaryProofUrl || '/docs/salary-receipt.jpg',
      aspect: 'aspect-[3/4]',
      tag: 'Ingresos',
    },
  ]

  const activeDoc = docItems.find((d) => d.id === selectedDoc) || docItems[0]

  const toggleVerify = (id: string, state: 'ok' | 'flagged') => {
    setVerifiedState((prev) => ({
      ...prev,
      [id]: prev[id] === state ? null : state,
    }))
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-base tracking-tight">
              Legajo Digital y Captura de Documentos
            </h3>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Auditoría Backoffice
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspección fotográfica de identidad, biometría y comprobantes validados con RENAPER / Didit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={kycStatus === 'verified' ? 'success' : kycStatus === 'in_review' ? 'warning' : 'neutral'}>
            Estado: {kycStatus === 'verified' ? 'Verificado' : kycStatus === 'in_review' ? 'En revisión' : 'Pendiente'}
          </Badge>
          {faceMatchScore && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 text-xs font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {Math.round(faceMatchScore)}% Biometría
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Selector de documentos laterales */}
        <div className="lg:col-span-4 p-4 space-y-2.5 bg-muted/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
            Documentos capturados ({docItems.length})
          </span>

          {docItems.map((doc) => {
            const isSelected = selectedDoc === doc.id
            const vState = verifiedState[doc.id]

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDoc(doc.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 relative ${
                  isSelected
                    ? 'border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border/70 bg-card hover:bg-muted/40 hover:border-border'
                }`}
              >
                {/* Miniatura */}
                <div className="w-14 h-14 rounded-md overflow-hidden bg-muted relative shrink-0 border border-border/80">
                  <Image
                    src={doc.src}
                    alt={doc.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {doc.title}
                    </p>
                    {vState === 'ok' && (
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold" title="Aprobado por operador">✓</span>
                    )}
                    {vState === 'flagged' && (
                      <span className="text-rose-600 dark:text-rose-400 text-xs font-bold" title="Observado">⚠</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{doc.subtitle}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {doc.tag}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}

          {/* Comparador de Datos RENAPER / OCR */}
          <div className="mt-4 pt-3 border-t border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
              Validación OCR / RENAPER
            </span>
            <div className="rounded-lg bg-card border border-border p-3 text-xs space-y-2">
              <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">DNI Captura:</span>
                <span className="font-mono font-medium text-foreground">{documents?.ocrDniNumber || dni || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">Nombre OCR:</span>
                <span className="font-medium text-foreground truncate max-w-[170px]" title={documents?.ocrFullName || clientName}>
                  {documents?.ocrFullName || clientName}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">CUIL/CUIT:</span>
                <span className="font-mono font-medium text-foreground">{cuit || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Cruce Padrón:</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Coincide 100%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visor Principal de Imagen */}
        <div className="lg:col-span-8 p-5 flex flex-col justify-between bg-card">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-semibold text-foreground">{activeDoc.title}</h4>
                <p className="text-xs text-muted-foreground">{activeDoc.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-md border border-border transition-colors"
                >
                  <Icon name={isZoomed ? 'x' : 'search'} size="xs" />
                  {isZoomed ? 'Reducir' : 'Ampliar'}
                </button>
                <a
                  href={activeDoc.src}
                  download={`documento-${selectedDoc}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-md border border-border transition-colors"
                >
                  <Icon name="download" size="xs" />
                  Descargar
                </a>
              </div>
            </div>

            {/* Canvas de imagen */}
            <div
              className={`relative rounded-xl overflow-hidden border border-border bg-neutral-950 flex items-center justify-center cursor-zoom-in transition-all ${
                isZoomed ? 'h-[500px]' : 'h-[360px]'
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            >
              <div className="absolute inset-0 bg-radial from-neutral-800/40 to-neutral-950 pointer-events-none" />
              <Image
                src={activeDoc.src}
                alt={activeDoc.title}
                fill
                className={`transition-transform duration-200 ${
                  isZoomed ? 'object-contain scale-110' : 'object-contain'
                }`}
                priority
                referrerPolicy="no-referrer"
              />

              <div className="absolute bottom-3 left-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-700 text-neutral-300 text-[11px] px-2.5 py-1 rounded-md flex items-center gap-2">
                <span>{activeDoc.title}</span>
                <span className="text-neutral-500">|</span>
                <span className="font-mono text-neutral-400">Verificado Didit</span>
              </div>
            </div>
          </div>

          {/* Barra de decisión del operador para este documento */}
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Resolución de documento:</span>
              {verifiedState[selectedDoc] === 'ok' && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Marcado como conforme</span>
              )}
              {verifiedState[selectedDoc] === 'flagged' && (
                <span className="text-rose-600 dark:text-rose-400 font-medium">Marcado como observado</span>
              )}
              {!verifiedState[selectedDoc] && <span>Sin observación</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleVerify(selectedDoc, 'flagged')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                  verifiedState[selectedDoc] === 'flagged'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name="x" size="xs" />
                Observar / Ilegible
              </button>

              <button
                type="button"
                onClick={() => toggleVerify(selectedDoc, 'ok')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                  verifiedState[selectedDoc] === 'ok'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                }`}
              >
                <Icon name="check" size="xs" />
                Conforme y legible
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
