import { Badge } from '@/components/ui/badge'
import { PAYOUT_STATUS_LABELS, label } from '@/lib/credit/labels'

const VARIANT = { queued: 'reviewing', executed: 'success', cancelled: 'secondary', failed: 'destructive' } as const

export function PayoutStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status as keyof typeof VARIANT] ?? 'secondary'}>{label(PAYOUT_STATUS_LABELS, status)}</Badge>
}
