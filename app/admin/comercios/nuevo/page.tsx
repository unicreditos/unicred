import { BackLink, NoAccess, PageHead, Pad } from '@/components/uc/blocks'
import { CreateMerchantForm } from '@/components/uc/merchant-admin'
import { loadDesk } from '@/lib/admin-desk/load'

export const metadata = { title: 'Alta de comercio' }

export default async function NuevoComercio() {
  const { perms } = await loadDesk()
  if (!perms.has('merchants.write')) return <NoAccess what="el alta de comercios" />
  return (
    <>
      <BackLink href="/admin/comercios">Comercios</BackLink>
      <PageHead title="Alta de comercio" description="Cargá los datos básicos. Después pedí la documentación desde la ficha." />
      <Pad><CreateMerchantForm /></Pad>
    </>
  )
}
