import { Plus_Jakarta_Sans, Syne } from 'next/font/google'
import type { ReactNode } from 'react'
import './pedir.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-lp-display',
  weight: ['500', '600', '700', '800'],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-lp-body',
  weight: ['400', '500', '600', '700'],
})

export default function PedirGroupLayout({ children }: { children: ReactNode }) {
  return <div className={`lp-root ${syne.variable} ${jakarta.variable}`}>{children}</div>
}
