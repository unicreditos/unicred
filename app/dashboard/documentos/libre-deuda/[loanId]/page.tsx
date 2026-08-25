import { CertificateDocumentPage } from '@/components/documents/certificate-document-page'

export const dynamic = 'force-dynamic'

export default async function LibreDeudaPage({ params }: { params: Promise<{ loanId: string }> }) {
  return <CertificateDocumentPage kind="libre_deuda" loanId={(await params).loanId} />
}
