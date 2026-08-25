import { CertificateDocumentPage } from '@/components/documents/certificate-document-page'

export const dynamic = 'force-dynamic'

export default async function SolvenciaPage({ params }: { params: Promise<{ loanId: string }> }) {
  return <CertificateDocumentPage kind="solvencia" loanId={(await params).loanId} />
}
