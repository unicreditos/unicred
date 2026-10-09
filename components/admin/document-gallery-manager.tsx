'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'

export interface DocumentItem {
  id: string
  clientName: string
  clientEmail: string
  clientId?: string
  docType: 'DNI frente' | 'DNI dorso' | 'Selfie con DNI' | 'Video de prueba de vida' | 'Recibo de sueldo'
  status: 'Pendiente' | 'Aprobado' | 'Observado'
  uploadedAt: string | null
  reviewedAt: string | null
  imageUrl: string
  ocrConfidence?: number
}

interface DocumentGalleryManagerProps {
  documents: DocumentItem[]
}

export function DocumentGalleryManager({ documents }: DocumentGalleryManagerProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [activeFilter, setActiveFilter] = useState<'all' | 'Pendiente' | 'Aprobado' | 'Observado'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPreview, setSelectedPreview] = useState<DocumentItem | null>(null)
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'Pendiente' | 'Aprobado' | 'Observado'>>({})

  const filtered = documents.filter((doc) => {
    const currentStatus = itemStatuses[doc.id] || doc.status
    if (activeFilter !== 'all' && currentStatus !== activeFilter) return false
    if (typeFilter !== 'all' && doc.docType !== typeFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        doc.clientName.toLowerCase().includes(q) ||
        doc.clientEmail.toLowerCase().includes(q) ||
        doc.docType.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const setStatus = (id: string, newStatus: 'Pendiente' | 'Aprobado' | 'Observado') => {
    setItemStatuses((prev) => ({
      ...prev,
      [id]: newStatus,
    }))
  }

  const counts = {
    all: documents.length,
    Pendiente: documents.filter((d) => (itemStatuses[d.id] || d.status) === 'Pendiente').length,
    Aprobado: documents.filter((d) => (itemStatuses[d.id] || d.status) === 'Aprobado').length,
    Observado: documents.filter((d) => (itemStatuses[d.id] || d.status) === 'Observado').length,
  }

  return (
    <div className="space-y-4">
      {/* Controles superiores modernos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de estado con badges dinámicos */}
          {(['all', 'Pendiente', 'Aprobado', 'Observado'] as const).map((filter) => {
            const isCurrent = activeFilter === filter
            const count = counts[filter]
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{filter === 'all' ? 'Todos' : filter}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isCurrent ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Input de búsqueda */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 w-44 md:w-56 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            <span className="absolute left-2.5 top-2 text-muted-foreground">
              <Icon name="search" size="xs" />
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" size="xs" />
              </button>
            )}
          </div>

          {/* Toggle vista Cuadrícula / Tabla */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Vista cuadrícula"
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="box" size="xs" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Vista tabla"
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'table' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="file" size="xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Galería de Tarjetas Visuales (Vista recomendada con imagen visible) */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const currentStatus = itemStatuses[doc.id] || doc.status
            return (
              <div
                key={doc.id}
                className="group rounded-xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Header de la tarjeta */}
                <div className="p-3 border-b border-border/60 bg-muted/20 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={doc.clientName}>
                      {doc.clientName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate" title={doc.clientEmail}>
                      {doc.clientEmail}
                    </p>
                  </div>
                  <Badge
                    tone={
                      currentStatus === 'Aprobado'
                        ? 'success'
                        : currentStatus === 'Observado'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {currentStatus}
                  </Badge>
                </div>

                {/* Previsualización fotográfica del documento */}
                <div
                  className="relative h-44 bg-neutral-950 overflow-hidden cursor-pointer flex items-center justify-center group-hover:opacity-95 transition-opacity"
                  onClick={() => setSelectedPreview(doc)}
                >
                  <Image
                    src={doc.imageUrl}
                    alt={doc.docType}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 300px"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[11px]">
                    <span className="font-medium bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10">
                      {doc.docType}
                    </span>
                    <span className="text-[10px] bg-black/50 px-1.5 py-0.5 rounded text-white/80">
                      Zoom 🔍
                    </span>
                  </div>
                </div>

                {/* Pie de tarjeta con acciones rápidas */}
                <div className="p-3 bg-card border-t border-border flex items-center justify-between gap-1">
                  {doc.clientId ? (
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(doc.clientId)}`}
                      className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Ver legajo →
                    </Link>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Digitalizado</span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Observar documento"
                      onClick={() => setStatus(doc.id, 'Observado')}
                      className={`p-1.5 rounded-md border text-xs transition-colors ${
                        currentStatus === 'Observado'
                          ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon name="x" size="xs" />
                    </button>
                    <button
                      type="button"
                      title="Aprobar documento"
                      onClick={() => setStatus(doc.id, 'Aprobado')}
                      className={`p-1.5 rounded-md border text-xs transition-colors ${
                        currentStatus === 'Aprobado'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      }`}
                    >
                      <Icon name="check" size="xs" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Vista Tabla tabular */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Captura</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((doc) => {
                  const currentStatus = itemStatuses[doc.id] || doc.status
                  return (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPreview(doc)}
                          className="w-12 h-10 rounded-md overflow-hidden bg-muted relative block border border-border hover:ring-2 hover:ring-primary/40"
                        >
                          <Image
                            src={doc.imageUrl}
                            alt={doc.docType}
                            fill
                            className="object-cover"
                            sizes="48px"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-foreground">{doc.clientName}</p>
                        <p className="text-muted-foreground text-[11px]">{doc.clientEmail}</p>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-foreground">{doc.docType}</td>
                      <td className="py-2.5 px-4">
                        <Badge
                          tone={
                            currentStatus === 'Aprobado'
                              ? 'success'
                              : currentStatus === 'Observado'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {currentStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground font-mono">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPreview(doc)}
                            className="px-2 py-1 text-xs rounded border border-border bg-card hover:bg-muted text-foreground"
                          >
                            Inspeccionar
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(doc.id, 'Aprobado')}
                            className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-600/30 hover:bg-emerald-100"
                          >
                            Aprobar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Zoom de alta resolución para inspección minuciosa */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div>
                <h3 className="font-semibold text-foreground text-sm">{selectedPreview.docType}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPreview.clientName} · {selectedPreview.clientEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Icon name="x" size="sm" />
              </button>
            </div>

            <div className="relative h-96 w-full bg-neutral-950 flex items-center justify-center p-2">
              <Image
                src={selectedPreview.imageUrl}
                alt={selectedPreview.docType}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 700px"
                priority
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-3">
              <a
                href={selectedPreview.imageUrl}
                download={`${selectedPreview.clientName}-${selectedPreview.docType}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                <Icon name="download" size="xs" />
                Descargar original
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatus(selectedPreview.id, 'Observado')
                    setSelectedPreview(null)
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 font-medium"
                >
                  Observar / Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus(selectedPreview.id, 'Aprobado')
                    setSelectedPreview(null)
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Aprobar documento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
