import { revalidatePath } from 'next/cache'

/** Rutas reales de la app. El panel cliente vive en `/dashboard?tab=...`. */
export const APP_PATHS = {
  home: '/',
  dashboard: '/dashboard',
  admin: '/admin',
  merchant: '/merchant',
} as const

export function revalidateCustomer() {
  revalidatePath(APP_PATHS.dashboard)
}

export function revalidateOps() {
  revalidatePath(APP_PATHS.dashboard)
  revalidatePath(APP_PATHS.admin)
  revalidatePath(APP_PATHS.merchant)
}
