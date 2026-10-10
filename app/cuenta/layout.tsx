import '../uc.css'
import { UcStandalone } from '@/components/uc/standalone'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UcStandalone>{children}</UcStandalone>
}