import { DESK_CACHE_TAG } from '@/lib/admin-desk/load'
import { revalidateTag, updateTag } from 'next/cache'

/**
 * La mesa de créditos lee una foto cacheada del backoffice: cada cambio de una venta en comercio la invalida
 * para que la solicitud aparezca al instante. En server actions expira ya; fuera de ellas (webhooks), se marca vieja.
 */
export function touchDesk() {
  try {
    updateTag(DESK_CACHE_TAG)
  } catch {
    try {
      revalidateTag(DESK_CACHE_TAG, 'max')
    } catch {
      /* fuera de un request de Next (scripts): no hay caché que invalidar */
    }
  }
}
