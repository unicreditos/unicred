export type CustomerDocKind =
  | 'contrato'
  | 'pagare'
  | 'arca'
  | 'bcra'
  | 'talonario'
  | 'estado-deuda'
  | 'intimacion'
  | 'recibo'
  | 'liquidacion'
  | 'solvencia'
  | 'libre-deuda'
  | 'cancelacion'

export function documentPrintPath(kind: CustomerDocKind, id: string) {
  const safe = encodeURIComponent(id)
  const path = (() => {
    switch (kind) {
      case 'contrato':
        return `/dashboard/documentos/contrato/${safe}`
      case 'pagare':
        return `/dashboard/documentos/pagare/${safe}`
      case 'arca':
        return `/dashboard/documentos/constancia-arca/${safe}`
      case 'bcra':
        return `/dashboard/documentos/informe-bcra/${safe}`
      case 'talonario':
        return `/dashboard/documentos/cuponera/${safe}`
      case 'estado-deuda':
        return `/dashboard/documentos/estado-deuda/${safe}`
      case 'intimacion':
        return `/dashboard/documentos/intimacion/${safe}`
      case 'recibo':
        return `/dashboard/documentos/recibo/${safe}`
      case 'liquidacion':
        return `/dashboard/documentos/liquidacion/${safe}`
      case 'solvencia':
        return `/dashboard/documentos/solvencia/${safe}`
      case 'libre-deuda':
        return `/dashboard/documentos/libre-deuda/${safe}`
      case 'cancelacion':
        return `/dashboard/documentos/cancelacion/${safe}`
    }
  })()
  return `${path}?print=1`
}

export function documentEmbedSrc(kind: CustomerDocKind, id: string) {
  return documentPrintPath(kind, id).replace('?print=1', '?embed=1')
}

export function documentKindTitle(kind: CustomerDocKind) {
  switch (kind) {
    case 'contrato':
      return 'Contrato de préstamo'
    case 'pagare':
      return 'Pagaré'
    case 'arca':
      return 'Constancia ARCA'
    case 'bcra':
      return 'Informe BCRA'
    case 'talonario':
      return 'Talonario de cuotas'
    case 'estado-deuda':
      return 'Estado de deuda'
    case 'intimacion':
      return 'Intimación de mora'
    case 'recibo':
      return 'Recibo'
    case 'liquidacion':
      return 'Liquidación'
    case 'solvencia':
      return 'Certificado de solvencia'
    case 'libre-deuda':
      return 'Constancia de libre deuda'
    case 'cancelacion':
      return 'Liquidación de cancelación'
  }
}

export function customerTabForKind(kind: CustomerDocKind) {
  if (kind === 'contrato') return 'documentos_contrato'
  if (kind === 'pagare') return 'documentos_pagare'
  if (kind === 'talonario') return 'documentos_talonario'
  if (kind === 'recibo' || kind === 'liquidacion') return 'comprobantes'
  return 'documentos'
}

export function customerDashboardDocUrl(kind: CustomerDocKind, id?: string) {
  const q = new URLSearchParams({ tab: customerTabForKind(kind), doc: kind })
  if (id) q.set('docId', id)
  return `/dashboard?${q.toString()}`
}

const PRINT_PATHS: Array<{ prefix: string; kind: CustomerDocKind }> = [
  { prefix: '/dashboard/documentos/contrato/', kind: 'contrato' },
  { prefix: '/dashboard/documentos/pagare/', kind: 'pagare' },
  { prefix: '/dashboard/documentos/constancia-arca/', kind: 'arca' },
  { prefix: '/dashboard/documentos/informe-bcra/', kind: 'bcra' },
  { prefix: '/dashboard/documentos/cuponera/', kind: 'talonario' },
  { prefix: '/dashboard/documentos/estado-deuda/', kind: 'estado-deuda' },
  { prefix: '/dashboard/documentos/intimacion/', kind: 'intimacion' },
  { prefix: '/dashboard/documentos/recibo/', kind: 'recibo' },
  { prefix: '/dashboard/documentos/liquidacion/', kind: 'liquidacion' },
  { prefix: '/dashboard/documentos/solvencia/', kind: 'solvencia' },
  { prefix: '/dashboard/documentos/libre-deuda/', kind: 'libre-deuda' },
  { prefix: '/dashboard/documentos/cancelacion/', kind: 'cancelacion' },
]

export function parsePrintDocumentPath(pathname: string): { kind: CustomerDocKind; id: string } | null {
  for (const row of PRINT_PATHS) {
    if (pathname.startsWith(row.prefix)) {
      const id = decodeURIComponent(pathname.slice(row.prefix.length).replace(/\/$/, ''))
      if (id) return { kind: row.kind, id }
    }
  }
  return null
}

export function isCustomerDocKind(value: string | null): value is CustomerDocKind {
  return (
    value === 'contrato' ||
    value === 'pagare' ||
    value === 'arca' ||
    value === 'bcra' ||
    value === 'talonario' ||
    value === 'estado-deuda' ||
    value === 'intimacion' ||
    value === 'recibo' ||
    value === 'liquidacion' ||
    value === 'solvencia' ||
    value === 'libre-deuda' ||
    value === 'cancelacion'
  )
}
