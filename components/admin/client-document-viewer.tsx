'use client'

import { useState } from 'react'
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
    videoUrl?: string | null
    ocrDniNumber?: string | null
    ocrFullName?: string | null
    ocrBirthDate?: string | null
    ocrGender?: string | null
    ocrAddress?: string | null
  }
}

type DocId = 'dniFront' | 'dniBack' | 'selfie' | 'salary' | 'video'

function digits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function dniVerdict(profileDni: string, ocrDni: string | null | undefined): 'match' | 'mismatch' | 'unknown' {
  const profile = digits(profileDni)
  const ocr = digits(ocrDni)
  if (profile.length < 7 || ocr.length < 7) return 'unknown'
  if (profile === ocr || profile.endsWith(ocr) || ocr.endsWith(profile)) return 'match'
  return 'mismatch'
}

export function ClientDocumentViewer({
  clientName,
  dni,
  cuit,
  kycStatus,
  faceMatchScore,
  documents,
}: ClientDocumentViewerProps) {
  const docItems = [
    documents?.dniFrontUrl
      ? { id: 'dniFront' as const, title: 'DNI Frente', subtitle: 'Captura Didit', src: documents.dniFrontUrl, tag: 'Frente', video: false }
      : null,
    documents?.dniBackUrl
      ? { id: 'dniBack' as const, title: 'DNI Dorso', subtitle: 'Captura Didit', src: documents.dniBackUrl, tag: 'Dorso', video: false }
      : null,
    documents?.selfieUrl
      ? {
          id: 'selfie' as const,
          title: 'Selfie',
          subtitle: 'Captura biométrica',
          src: documents.selfieUrl,
          tag: faceMatchScore != null ? `Match ${Math.round(faceMatchScore)}%` : 'Sin score facial',
          video: false,
        }
      : null,
    documents?.videoUrl
      ? { id: 'video' as const, title: 'Prueba de vida', subtitle: 'Video Didit', src: documents.videoUrl, tag: 'Video', video: true }
      : null,
    documents?.salaryProofUrl
      ? { id: 'salary' as const, title: 'Comprobante de ingresos', subtitle: 'Archivo cargado', src: documents.salaryProofUrl, tag: 'Ingresos', video: false }
      : null,
  ].filter((item): item is { id: DocId; title: string; subtitle: string; src: string; tag: string; video: boolean } => Boolean(item))

  const [selectedDoc, setSelectedDoc] = useState<DocId>(docItems[0]?.id ?? 'dniFront')
  const [isZoomed, setIsZoomed] = useState(false)
  const activeDoc = docItems.find((d) => d.id === selectedDoc) || docItems[0]
  const verdict = dniVerdict(dni, documents?.ocrDniNumber)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-4">
        <div>
          <h3 className="font-semibold text-foreground text-base tracking-tight">
            Legajo digital
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capturas persistidas de la verificación Didit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={kycStatus === 'verified' ? 'success' : kycStatus === 'in_review' ? 'warning' : 'neutral'}>
            Estado: {kycStatus === 'verified' ? 'Verificado' : kycStatus === 'in_review' ? 'En revisión' : kycStatus === 'rejected' ? 'Rechazado' : 'Pendiente'}
          </Badge>
          {faceMatchScore != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 text-xs font-mono font-medium">
              {Math.round(faceMatchScore)}% biometría
            </span>
          )}
        </div>
      </div>

      {docItems.length === 0 || !activeDoc ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Este cliente no tiene imágenes de DNI, selfie ni video guardados.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="lg:col-span-4 p-4 space-y-2.5 bg-muted/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
              Documentos capturados ({docItems.length})
            </span>
            {docItems.map((doc) => {
              const isSelected = selectedDoc === doc.id
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDoc(doc.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                      : 'border-border/70 bg-card hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <div className="w-14 h-14 rounded-md overflow-hidden bg-muted relative shrink-0 border border-border/80">
                    {doc.video ? (
                      <video src={doc.src} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img src={doc.src} alt={doc.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {doc.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{doc.subtitle}</p>
                    <span className="mt-1.5 inline-block text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {doc.tag}
                    </span>
                  </div>
                </button>
              )
            })}

            <div className="mt-4 pt-3 border-t border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
                Datos leídos del documento
              </span>
              <div className="rounded-lg bg-card border border-border p-3 text-xs space-y-2">
                <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">DNI de la ficha:</span>
                  <span className="font-mono font-medium text-foreground">{dni || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">DNI leído:</span>
                  <span className="font-mono font-medium text-foreground">{documents?.ocrDniNumber || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">Nombre leído:</span>
                  <span className="font-medium text-foreground truncate max-w-[170px]" title={documents?.ocrFullName || ''}>
                    {documents?.ocrFullName || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-border/50">
                  <span className="text-muted-foreground">CUIL/CUIT:</span>
                  <span className="font-mono font-medium text-foreground">{cuit || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Cruce de DNI:</span>
                  <span className={verdict === 'match' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : verdict === 'mismatch' ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground'}>
                    {verdict === 'match' ? 'Coincide' : verdict === 'mismatch' ? 'No coincide' : 'Sin evidencia'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 p-5 flex flex-col justify-between bg-card">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-base font-semibold text-foreground">{activeDoc.title}</h4>
                  <p className="text-xs text-muted-foreground">{activeDoc.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!activeDoc.video ? (
                    <button
                      type="button"
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-md border border-border transition-colors"
                    >
                      <Icon name={isZoomed ? 'x' : 'search'} size="xs" />
                      {isZoomed ? 'Reducir' : 'Ampliar'}
                    </button>
                  ) : null}
                  <a
                    href={activeDoc.src}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-md border border-border transition-colors"
                  >
                    <Icon name="download" size="xs" />
                    Abrir
                  </a>
                </div>
              </div>
              <div
                className={`relative rounded-xl overflow-hidden border border-border bg-neutral-950 flex items-center justify-center ${
                  isZoomed ? 'h-[500px]' : 'h-[360px]'
                }`}
              >
                {activeDoc.video ? (
                  <video src={activeDoc.src} className="h-full w-full object-contain" controls playsInline />
                ) : (
                  <img
                    src={activeDoc.src}
                    alt={activeDoc.title}
                    className={`h-full w-full object-contain ${isZoomed ? 'scale-110' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </div>
            <p className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              La decisión de identidad se registra en Validación de identidad. {clientName ? `Legajo de ${clientName}.` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
