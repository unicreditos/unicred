import { ContentTabs } from '@/components/admin/content-tabs'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import { getContentAccess } from '@/lib/site-config/access'

export const metadata = { title: 'Configuración y contenido' }

const TABS = [
  { href: '/admin/contenido/comisiones', label: 'Comisiones y tasas' },
  { href: '/admin/contenido/textos', label: 'Textos de la web' },
  { href: '/admin/contenido/legal', label: 'Documentación legal' },
  { href: '/admin/contenido/parametros', label: 'Parámetros' },
  { href: '/admin/contenido/historial', label: 'Historial' },
]

export default async function ContenidoLayout({ children }: { children: React.ReactNode }) {
  const access = await getContentAccess()
  const head = (
    <PageHead
      title="Configuración y contenido"
      description="Editá comisiones, tasas, textos y documentación de la web sin tocar código. Todo se guarda en la base, con historial y aprobación."
    />
  )
  if (!access.any) return <>{head}<NoAccess what="la configuración y el contenido" /></>
  return (
    <>
      {head}
      <ContentTabs tabs={TABS} />
      {children}
    </>
  )
}
