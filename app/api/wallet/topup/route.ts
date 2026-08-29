import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import {
  requireMobileAdmin,
  mobileApplyLoan,
  mobileLoanDetail,
  mobileLoanContract,
  mobileSignLoan,
  mobileCalculateCredit,
  mobileCreatePayment,
  mobilePaymentHistory,
  mobilePaymentReceipt,
  mobileWalletTopup,
  mobileWalletTransfer,
  mobileWalletPayout,
  mobileWalletPayInstallments,
  mobileServicesMine,
  mobileServicesPay,
  mobileListDocuments,
  mobileVerifyIdentity,
  mobileNotificationRead,
  mobileNotificationReadAll,
  mobileGetNotifPrefs,
  mobileSetNotifPrefs,
  mobileSupportList,
  mobileSupportPost,
  mobilePresign,
  mobileUploadComplete,
  mobileFileUrl,
  mobileFileDelete,
  mobilePushRegister,
  mobilePushDelete,
  mobileAdminDashboard,
  mobileAdminLoans,
  mobileAdminApproveLoan,
  mobileAdminRejectLoan,
  mobileAdminDisburseLoan,
  mobileAdminCustomers,
  mobileAdminSetScore,
  mobileAdminKycApprove,
  mobileAdminKycReject,
  mobileAdminPayments,
} from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    
    const body = ['POST','PUT','PATCH'].includes('POST') ? await req.json().catch(() => ({})) : {}
    return mobileJson(req, await mobileWalletTopup(userId, Number((body as any).amount)))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) || message === 'unauthorized' ? 401 : /No autorizado/i.test(message) ? 403 : 400
    return mobileJson(req, { message }, { status })
  }
}
