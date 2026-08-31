import { CertificateDocumentPage } from '@/components/documents/certificate-document-page'

export const dynamic = 'force-dynamic'

export default async function LibreDeudaPage({
  params,
  searchParams,
}: {
  params: Promise<{ loanId: string }>
  searchParams: Promise<{ embed?: string | string[] }>
}) {
  return <CertificateDocumentPage kind="libre_deuda" loanId={(await params).loanId} searchParams={searchParams} />
}
