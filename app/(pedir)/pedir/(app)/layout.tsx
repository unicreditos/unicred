import type { ReactNode } from 'react'

/** Layout del área autenticada: aislada del sitio público de marketing. */
export default function PedirAppSegmentLayout({ children }: { children: ReactNode }) {
  return <div className="lp-app-root">{children}</div>
}
