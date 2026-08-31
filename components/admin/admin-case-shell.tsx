'use client'

import { AdminAppShell, type AdminTabId } from '@/components/admin/admin-app-shell'
import { adminUrl } from '@/lib/admin-nav'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function AdminCaseShell({
  user,
  activeTab,
  title,
  subtitle,
  children,
}: {
  user: { id: string; name: string | null; email: string | null; image: string | null }
  activeTab: AdminTabId
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <AdminAppShell
      user={user}
      activeTab={activeTab}
      onTabChange={(tab) => router.push(adminUrl(tab))}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </AdminAppShell>
  )
}
