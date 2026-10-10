/**
 * Acceso a una cuota por su cupon: solo el dueno o un administrador.
 * Misma semantica que getLoanCouponQrs: una cuota ajena o inexistente da el mismo error (no se puede
 * averiguar si un id existe).
 */
export const COUPON_FORBIDDEN_MESSAGE = 'No podés ver esta cuota.'

export async function assertCanViewCouponInstallment(
  viewerId: string,
  ownerId: string | null | undefined,
  canView: (viewerId: string, ownerId: string) => Promise<boolean>,
) {
  if (!ownerId || !(await canView(viewerId, ownerId))) throw new Error(COUPON_FORBIDDEN_MESSAGE)
}