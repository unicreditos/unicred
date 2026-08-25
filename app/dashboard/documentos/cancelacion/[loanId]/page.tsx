import { CertificateDocumentPage } from '@/components/documents/certificate-document-page'

export const dynamic = 'force-dynamic'

export default async function CancelacionPage({ params }: { params: Promise<{ loanId: string }> }) {
  return <CertificateDocumentPage kind="cancelacion" loanId={(await params).loanId} />
}
