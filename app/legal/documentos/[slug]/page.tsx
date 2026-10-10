import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { pageMetadata } from '@/lib/seo'
import { getSetting } from '@/lib/site-config/read'
import { LEGAL_DOC_KEYS } from '@/lib/site-config/registry'

type Doc = { title: string; versionLabel: string; effectiveFrom: string; summary: string; body: string }

async function load(slug: string) {
  const key = `legal.${slug}`
  if (!LEGAL_DOC_KEYS.includes(key)) return null
  const r = await getSetting<Doc>(key)
  // Solo se muestra un texto cargado desde el panel, publicado y marcado como visible. Si no, la página no existe.
  if (r.source !== 'published' || !r.value.body.trim()) return null
  return r.value
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await load(slug)
  return pageMetadata({ title: doc?.title ?? 'Documentación legal', description: doc?.summary || 'Documento legal de UNICRÉDITOS.', path: `/legal/documentos/${slug}` })
}

export default async function DocumentoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await load(slug)
  if (!doc) notFound()
  const [y, m, d] = doc.effectiveFrom.split('-')
  return (
    <PublicPageShell eyebrow={`${doc.versionLabel} · vigente desde ${d}/${m}/${y}`} title={doc.title} description={doc.summary || undefined} icon={<FileText className="h-3.5 w-3.5" />}>
      <PageSection title="Texto completo">
        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          {doc.body
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>
      </PageSection>
    </PublicPageShell>
  )
}
