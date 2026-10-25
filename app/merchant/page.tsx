import { redirect } from "next/navigation"
import { getSession, requireMerchant } from "@/lib/session"
import { getMyMerchant, getMyMerchantDocuments } from "@/app/actions/merchant"
import { getMerchantCommerce } from "@/app/actions/merchant-commerce"
import { getMyDiditApproved } from "@/app/actions/didit"
import { MerchantTabsClient } from "@/app/merchant/_client"

export const metadata = {
  title: 'Panel de comercio',
  robots: { index: false, follow: false },
}

export default async function MerchantPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; case?: string }>
}) {
  await requireMerchant()
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const merchant = await getMyMerchant()
  const commerce = merchant?.status === "active" ? await getMerchantCommerce() : null
  const documents = await getMyMerchantDocuments()
  const titularDiditApproved = await getMyDiditApproved()
  const params = await searchParams

  const user = {
    name: session.user.name ?? session.user.email ?? "Usuario",
    email: session.user.email ?? "",
  }

  const status = (merchant as any)?.status as string | undefined
  const defaultTab =
    params.tab ||
    (merchant && status === "active" ? "overview" : "profile")

  return (
    <MerchantTabsClient
      user={user}
      merchant={merchant as any}
      commerce={commerce}
      defaultTab={defaultTab}
      supportCaseId={params.case}
      titularDiditApproved={titularDiditApproved}
      documents={documents as any}
    />
  )
}
