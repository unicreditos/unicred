import Link from 'next/link'
import { FileText } from 'lucide-react'
import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { pageMetadata } from '@/lib/seo'
import { getSetting } from '@/lib/site-config/read'
import { LEGAL_DOC_KEYS, LEGAL_DOC_PATH } from '@/lib/site-config/registry'

export const metadata = pageMetadata({
  title: 'Documentación legal',
  description: 'Documentos legales vigentes de UNICRÉDITOS, con su versión y fecha de entrada en vigencia.',
  path: '/legal/documentos',
})

type Doc = { title: string; versionLabel: string; effectiveFrom: string; summary: string; body: string }

function formatDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export default async function DocumentosPage() {
  // Títulos, versiones y fechas editables desde el backoffice; sin versión publicada rigen los del código.
  const docs = await Promise.all(
    LEGAL_DOC_KEYS.map(async (key) => {
      const r = await getSetting<Doc>(key)
      return { key, slug: key.replace(/^legal\./, ''), doc: r.value, hasPublishedBody: r.source === 'published' && r.value.body.trim().length > 0 }
    }),
  )

  return (
    <PublicPageShell
      eyebrow="Transparencia"
      title="Documentación legal"
      description="Versión y fecha de vigencia de cada documento. Antes de firmar siempre ves el texto completo."
      icon={<FileText className="h-3.5 w-3.5" />}
    >
      <PageSection title="Documentos vigentes">
        <div className="overflow-x-auto rounded-2xl border border-border/70">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Versión</th>
                <th className="px-4 py-3">Vigente desde</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(({ key, slug, doc, hasPublishedBody }) => (
                <tr key={key} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3">
                    <Link href={hasPublishedBody ? `/legal/documentos/${slug}` : LEGAL_DOC_PATH[key]} className="font-semibold text-brand-navy hover:text-brand-primary">
                      {doc.title}
                    </Link>
                    {doc.summary ? <p className="mt-1 text-xs text-muted-foreground">{doc.summary}</p> : null}
                  </td>
                  <td className="px-4 py-3">{doc.versionLabel}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(doc.effectiveFrom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PublicPageShell>
  )
}
