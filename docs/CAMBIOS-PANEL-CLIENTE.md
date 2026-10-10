# Cambios en el panel de cliente (rama `fix/panel-cliente-2026-10`)

Rama creada sobre `security/hardening-2026-10` (e3bdded). Sin despliegue, sin push y sin acceso a la base real.

## 1. CSS responsive (`app/uc.css`)
Los `@media` de 1180 y 1024 px usaban selectores del prototipo sin prefijo (`.app`, `.sidebar`, `.menu-btn`, `.kpis`, `.cols-21`...) que no existen en el HTML (las clases reales son `.uc-*`). El menú lateral quedaba fijo sobre el contenido y no se podía usar.
- Selectores corregidos a `.uc-*` y `.uc main`.
- Hasta 1024 px: `.uc-app` sin padding lateral, botón de menú visible, `.uc-sidebar` fuera de pantalla (`translateX(-100%)`) y se desliza al abrir (`.uc-drawer-open`) con el fondo oscurecido; en celular además la barra inferior.
- 1180 px: KPIs y pasos en 2 columnas; 1024 px: grillas 2/1 y 1/2 pasan a una columna; buscador al ancho completo.
- Los enlaces del menú lateral dejaban de leerse (el color de `.uc a` pisaba al del menú): corregido.

## 2. Enlace a `/cuenta/seguridad`
- Menú Perfil → "Verificación en dos pasos".
- Página Perfil → Seguridad: botón y aviso con el enlace; se quitó el texto "2FA todavía no está publicado".
- Menú del usuario (arriba a la derecha, en todos los paneles): "Seguridad de la cuenta".
- `/cuenta/seguridad` tiene enlace "Volver a mi cuenta" (según el rol).
- La prueba de aislamiento de paneles ahora admite ese único destino fuera de `/dashboard`, `/admin` y `/api`.

## 3. Estilos de seguridad, verificación en dos pasos y retorno de identidad
`uc.css` solo se importaba dentro de los paneles, así que `/cuenta/seguridad` y `/verificar-2fa` se veían sin estilos. Ahora `app/cuenta`, `app/verificar-2fa` y `app/verification` tienen un `layout.tsx` que importa `uc.css` y envuelve con `UcStandalone` (`components/uc/standalone.tsx`): tokens del sistema (`.uc`), barra con la marca (no en `/verification`, que se usa también embebida). Los botones del sistema anterior usados como enlace recuperan el color del texto.

## 4. `getCouponInstallment`
Exige sesión (`requireUserId`) y que la cuota sea del usuario o de un admin (`canViewOwnedRecord`). Cuota ajena o inexistente dan el mismo error ("No podés ver esta cuota."), como `getLoanCouponQrs`. Ya no devuelve `null`. Pruebas: `scripts/tests/coupon-access.test.ts`.

## 5. Topes de intentos (`lib/action-rate-limit.ts`)
Reutiliza `consumeRateLimit` (contador atómico en Postgres). Falla cerrado: si el contador no responde, se rechaza.

| Alcance | Tope | Acciones |
|---|---|---|
| `bcra` | 5 / 10 min | `consultMyBcra` |
| `credit-quote` | 20 / 10 min | `evaluateLoanOffer` |
| `credit-request` | 5 / 10 min | `requestLoan`, `requestProfileChange` |
| `claim` | 5 / 15 min | `createClaim`, `sendSupportMessage` |
| `payment` | 10 / 10 min | `createPaymentLink`, `createEarlySettlementCheckout`, `reportBankTransfer`, `/api/payments/mp-process` (429 + `Retry-After`) |
| `coupon-action` | 10 / 10 min | `createCouponCheckout` (por usuario o, sin sesión, por IP) |
| `coupon-lookup` | 60 / 10 min | `getCouponInstallment`, `getLoanCouponQrs`, `getInstallmentCoupons` |

Las acciones que devuelven `{ ok: false, error }` devuelven el aviso; las que lanzan errores, lanzan. Pruebas: `scripts/tests/action-rate-limit.test.ts`.

## Pendiente (no incluido)
Pantalla de billetera, CSS de impresión, tamaño táctil de controles (< 24 px), avatar como data-URL, lecturas con escritura en `getMyInstallments`, pruebas E2E, `createCouponCheckout` sin autenticación (solo se le puso tope), topes en las rutas móviles (`lib/mobile/ops`), SQL 01 a 04 en producción.