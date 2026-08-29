/**
 * Genera rutas Next del puente mobile a partir de una tabla.
 * Uso: npx tsx scripts/gen-mobile-routes.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'app', 'api')

type Spec = {
  file: string
  methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'>
  auth?: boolean
  admin?: boolean
  handler: string // expression using req, userId, body, params
}

const specs: Spec[] = [
  {
    file: 'loans/apply/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileApplyLoan(userId, body as any))`,
  },
  {
    file: 'loans/[id]/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileLoanDetail(userId, id))`,
  },
  {
    file: 'loans/[id]/contract/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileLoanContract(userId, id))`,
  },
  {
    file: 'loans/[id]/sign/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileSignLoan(userId, id, { ip: req.headers.get('x-forwarded-for') || undefined, ua: req.headers.get('user-agent') || undefined }))`,
  },
  {
    file: 'credit-products/calculate/route.ts',
    methods: ['POST'],
    handler: `return mobileJson(req, await mobileCalculateCredit(body as any))`,
  },
  {
    file: 'payments/create/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileCreatePayment(userId, body as any))`,
  },
  {
    file: 'payments/history/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `const u = new URL(req.url); return mobileJson(req, await mobilePaymentHistory(userId, Number(u.searchParams.get('page')||1), Number(u.searchParams.get('limit')||20)))`,
  },
  {
    file: 'payments/[id]/receipt/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobilePaymentReceipt(userId, id))`,
  },
  {
    file: 'wallet/topup/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileWalletTopup(userId, Number((body as any).amount)))`,
  },
  {
    file: 'wallet/transfer/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `const b = body as any; return mobileJson(req, await mobileWalletTransfer(userId, Number(b.amount), String(b.destination), b.concept ? String(b.concept) : undefined))`,
  },
  {
    file: 'wallet/payout/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileWalletPayout(userId, body as any))`,
  },
  {
    file: 'wallet/pay-installments/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `const ids = Array.isArray((body as any).installmentIds) ? (body as any).installmentIds.map(String) : []; return mobileJson(req, await mobileWalletPayInstallments(userId, ids))`,
  },
  {
    file: 'services/mine/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `return mobileJson(req, await mobileServicesMine(userId))`,
  },
  {
    file: 'services/pay/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileServicesPay(userId, body as any))`,
  },
  {
    file: 'users/documents/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `return mobileJson(req, await mobileListDocuments(userId))`,
  },
  {
    file: 'users/verify-identity/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileVerifyIdentity(userId, body as any))`,
  },
  {
    file: 'notifications/read-all/route.ts',
    methods: ['PUT'],
    auth: true,
    handler: `return mobileJson(req, await mobileNotificationReadAll(userId))`,
  },
  {
    file: 'notifications/[id]/read/route.ts',
    methods: ['PUT'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileNotificationRead(userId, id))`,
  },
  {
    file: 'notifications/preferences/route.ts',
    methods: ['GET', 'POST'],
    auth: true,
    handler: `if (req.method === 'GET') return mobileJson(req, await mobileGetNotifPrefs(userId)); return mobileJson(req, await mobileSetNotifPrefs(userId, body as any))`,
  },
  {
    file: 'support/chat/route.ts',
    methods: ['GET', 'POST'],
    auth: true,
    handler: `if (req.method === 'GET') { const u = new URL(req.url); return mobileJson(req, await mobileSupportList(userId, Number(u.searchParams.get('page')||1), Number(u.searchParams.get('limit')||50))) }; return mobileJson(req, await mobileSupportPost(userId, String((body as any).message||'')))`,
  },
  {
    file: 'upload/presigned/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobilePresign(userId, body as any))`,
  },
  {
    file: 'upload/complete/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `return mobileJson(req, await mobileUploadComplete(userId, body as any))`,
  },
  {
    file: 'upload/put/route.ts',
    methods: ['PUT', 'POST'],
    auth: true,
    handler: `return mobileJson(req, { ok: true, path: new URL(req.url).searchParams.get('path') })`,
  },
  {
    file: 'files/[id]/url/route.ts',
    methods: ['GET'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileFileUrl(userId, id))`,
  },
  {
    file: 'files/[id]/route.ts',
    methods: ['DELETE'],
    auth: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileFileDelete(userId, id))`,
  },
  {
    file: 'push-tokens/route.ts',
    methods: ['POST'],
    auth: true,
    handler: `const b = body as any; return mobileJson(req, await mobilePushRegister(userId, String(b.token), b.deviceType ? String(b.deviceType) : undefined))`,
  },
  {
    file: 'push-tokens/[token]/route.ts',
    methods: ['DELETE'],
    auth: true,
    handler: `const token = decodeURIComponent(String((await params).token)); return mobileJson(req, await mobilePushDelete(userId, token))`,
  },
  {
    file: 'admin/dashboard/route.ts',
    methods: ['GET'],
    auth: true,
    admin: true,
    handler: `return mobileJson(req, await mobileAdminDashboard())`,
  },
  {
    file: 'admin/loans/route.ts',
    methods: ['GET'],
    auth: true,
    admin: true,
    handler: `const u = new URL(req.url); return mobileJson(req, await mobileAdminLoans(u.searchParams.get('status')||undefined, Number(u.searchParams.get('page')||1), Number(u.searchParams.get('limit')||50)))`,
  },
  {
    file: 'admin/loans/[id]/approve/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminApproveLoan(userId, id))`,
  },
  {
    file: 'admin/loans/[id]/reject/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminRejectLoan(userId, id, String((body as any).reason||'')))`,
  },
  {
    file: 'admin/loans/[id]/disburse/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminDisburseLoan(userId, id))`,
  },
  {
    file: 'admin/customers/route.ts',
    methods: ['GET'],
    auth: true,
    admin: true,
    handler: `const u = new URL(req.url); return mobileJson(req, await mobileAdminCustomers(u.searchParams.get('search')||undefined, Number(u.searchParams.get('page')||1), Number(u.searchParams.get('limit')||50)))`,
  },
  {
    file: 'admin/customers/[id]/credit-score/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminSetScore(userId, id, Number((body as any).score)))`,
  },
  {
    file: 'admin/customers/[id]/kyc/approve/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminKycApprove(userId, id))`,
  },
  {
    file: 'admin/customers/[id]/kyc/reject/route.ts',
    methods: ['POST'],
    auth: true,
    admin: true,
    handler: `const id = String((await params).id); return mobileJson(req, await mobileAdminKycReject(userId, id, String((body as any).reason||'')))`,
  },
  {
    file: 'admin/payments/route.ts',
    methods: ['GET'],
    auth: true,
    admin: true,
    handler: `const u = new URL(req.url); return mobileJson(req, await mobileAdminPayments(Number(u.searchParams.get('page')||1), Number(u.searchParams.get('limit')||50)))`,
  },
]

function render(spec: Spec) {
  const needsParams = spec.file.includes('[')
  const methods = spec.methods
  const imports = [
    `import { requireMobileUserId${spec.admin ? ', requireMobileAdmin' : ''} } from '@/lib/mobile/auth'`,
    `import { mobileJson, mobileOptions } from '@/lib/mobile/cors'`,
    `import * as ops from '@/lib/mobile/ops'`,
  ]
  // Fix requireMobileAdmin - it's in ops not auth
  const importBlock = `import { requireMobileUserId } from '@/lib/mobile/auth'
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
`

  const paramType = needsParams
    ? `,{ params }: { params: Promise<Record<string, string>> }`
    : ''

  const fns = methods
    .map((m) => {
      return `export async function ${m}(req: Request${paramType}) {
  try {
    ${spec.auth ? 'const userId = await requireMobileUserId(req)' : 'const userId = null as unknown as string'}
    ${spec.admin ? 'await requireMobileAdmin(userId)' : ''}
    const body = ['POST','PUT','PATCH'].includes('${m}') ? await req.json().catch(() => ({})) : {}
    ${spec.handler.replace(/req\.method/g, `'${m}'`)}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) || message === 'unauthorized' ? 401 : /No autorizado/i.test(message) ? 403 : 400
    return mobileJson(req, { message }, { status })
  }
}`
    })
    .join('\n\n')

  return `${importBlock}
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

${fns}
`
}

for (const spec of specs) {
  const full = path.join(root, spec.file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, render(spec), 'utf8')
  console.log('wrote', spec.file)
}

console.log('done', specs.length)
