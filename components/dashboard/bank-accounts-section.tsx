'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  deleteBankAccount,
  lookupAndCreateBankAccount,
  setPrimaryBankAccount,
  updateBankAccount,
  validateBankAccountLive,
} from '@/app/actions/banking'
import { BancosPanel } from '@/components/dashboard/bancos-panel'

type PanelProps = React.ComponentProps<typeof BancosPanel>

/** Conecta el panel de cuentas con sus server actions y avisa con toasts. */
export function BankAccountsSection({
  accounts,
  profile,
  defaultHolderName,
}: Pick<PanelProps, 'accounts' | 'profile' | 'defaultHolderName'>) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const run = (task: () => Promise<string | void>, fallback: string) =>
    start(async () => {
      try {
        const msg = await task()
        if (msg) toast.success(msg)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : fallback)
      }
    })

  return (
    <BancosPanel
      accounts={accounts}
      profile={profile}
      defaultHolderName={defaultHolderName}
      isPending={pending}
      onLookupCreate={(identifier, setAsPrimary) =>
        run(async () => {
          const r = await lookupAndCreateBankAccount({ identifier, setAsPrimary })
          return r.message || 'Cuenta validada y guardada.'
        }, 'No se pudo validar la cuenta.')
      }
      onUpdate={(id, v) =>
        run(async () => {
          await updateBankAccount(id, v)
          return 'Cuenta actualizada. Volvé a validarla.'
        }, 'No se pudo actualizar la cuenta.')
      }
      onSetPrimary={(id) =>
        run(async () => {
          await setPrimaryBankAccount(id)
          return 'Cuenta principal actualizada.'
        }, 'No se pudo cambiar la cuenta principal.')
      }
      onDelete={(id) =>
        run(async () => {
          await deleteBankAccount(id)
          return 'Cuenta eliminada.'
        }, 'No se pudo eliminar la cuenta.')
      }
      onValidate={(id) =>
        run(async () => {
          const r = await validateBankAccountLive(id)
          if (!r.ok) throw new Error(r?.message || 'No se pudo validar la cuenta.')
          return r.message || 'Cuenta verificada.'
        }, 'No se pudo validar la cuenta.')
      }
    />
  )
}
