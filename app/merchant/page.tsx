import { redirect } from "next/navigation"
import { getSession, requireMerchant } from "@/lib/session"
import { getMyMerchant, getMerchantSales, getMyMerchantDocuments } from "@/app/actions/merchant"
import { getMyDiditApproved } from "@/app/actions/didit"
import { MerchantTabsClient } from "@/app/merchant/_client"

export default async function MerchantPage() {
  await requireMerchant()
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const merchant = await getMyMerchant()
  const sales = await getMerchantSales()
  const documents = await getMyMerchantDocuments()
  const titularDiditApproved = await getMyDiditApproved()

  const user = {
    name: session.user.name ?? session.user.email ?? "Usuario",
    email: session.user.email ?? "",
  }

  const status = (merchant as any)?.status as string | undefined
  const defaultTab: "overview" | "profile" | "sales" | "customers" | "liquidations" =
    merchant && status === "active" ? "overview" : "profile"

  return (
    <MerchantTabsClient
      user={user}
      merchant={merchant as any}
      sales={sales as any}
      defaultTab={defaultTab}
      titularDiditApproved={titularDiditApproved}
      documents={documents as any}
    />
  )
}
