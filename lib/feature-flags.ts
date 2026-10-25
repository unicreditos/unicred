/**
 * Alcance comercial del sitio público. Por ahora solo se promociona crédito
 * personal — el crédito comercial y el panel de comercios siguen funcionando
 * igual (altas, ventas, liquidaciones), esto únicamente oculta su marketing
 * en el sitio público (nav, home, footer). Cambiar a true reactiva esa
 * marketing sin tocar nada del código que quedó oculto.
 */
export const SHOW_MERCHANT_CREDIT_MARKETING = false

/**
 * Billetera interna (ledger propio) como medio de pago de cuotas en la web.
 * El CVU/alias que muestra se deriva por hash (lib/payments/cvu.ts): NO lo emite ningún
 * banco ni PSP y la red Coelsa no lo reconoce, y los Términos aclaran que no es un CVU real.
 * Se mantiene oculta hasta que exista un proveedor que emita CVU reales. Activar con
 * NEXT_PUBLIC_WALLET_LIVE=yes solo cuando eso esté contratado y probado con dinero real.
 */
export const SHOW_INTERNAL_WALLET = process.env.NEXT_PUBLIC_WALLET_LIVE === 'yes'
