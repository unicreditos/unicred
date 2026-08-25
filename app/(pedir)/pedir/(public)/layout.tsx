import type { ReactNode } from 'react'

/** Layout del sitio público / marketing del canal. */
export default function PedirPublicSegmentLayout({ children }: { children: ReactNode }) {
  return <div className="lp-public-root">{children}</div>
}
