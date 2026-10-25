# Estado operativo de UNICRÉDITOS (auditoría del 25/10/2026)

Qué está listo para operar con dinero real, qué es simulado y qué depende de terceros o de decisiones del negocio.
Este documento describe lo que se verificó en el código y en pruebas locales; no reemplaza una prueba con dinero real.

## 1. Verificado y operativo en el código
- Cálculo de cuota, TNA/TEA/CFT del simulador y del contrato (sistema francés, verificado a mano: $ 500.000 a 12 cuotas = $ 64.639).
- Controles previos al crédito: identidad Didit vigente, Key 6, consulta BCRA con autorización, decisión manual con nota y auditoría.
- Contrato, pagaré, cuponera, estado de deuda, cancelación y recibos.
- Cobro de cuotas por Mercado Pago con webhook firmado (HMAC) y recibos idempotentes; transferencia a RM con conciliación manual.
- Backoffice (originación, cobranzas, comercios, contenido, auditoría) y panel de comercio.
- Control de acceso por rol; ninguna ruta API devolvió datos ni error 500 sin sesión.

## 2. Simulado o no operativo (no declarar como "real" hasta resolverlo)
| Área | Estado real | Qué hace falta |
| --- | --- | --- |
| **Billetera: CVU y alias** | Se derivan por hash (`lib/payments/cvu.ts`). Ningún banco ni PSP los emite; la red Coelsa no los reconoce. Los Términos ya lo aclaran ("no es un CVU Coelsa ni una cuenta PSP"). | Contratar un proveedor que emita CVU reales (PSP / BaaS), con alta ante el BCRA como PSP y alta UIF. Hasta entonces la opción "Billetera UNICRÉDITOS" queda **oculta** en el pago de cuotas (`NEXT_PUBLIC_WALLET_LIVE=yes` la reactiva). |
| **Egresos de la billetera y pagos de servicios** | Quedan "en cola de tesorería RM" para ejecución manual. No hay riel bancario automático. | Integración bancaria o con el PSP (decisión abierta: Brubank/tesorería). |
| **Desembolso de créditos** | Cola de tesorería con acreditación manual; no hay transferencia automática. | Integración bancaria. |
| **Mercado Pago** | `.env.local` usa credenciales TEST; las de producción viven en `.env.production.local` y no se verificaron. | Probar un cobro real de bajo monto con las credenciales LIVE y confirmar la URL del webhook. |
| **Registro PNFC / UIF** | Los Términos dicen que no están inscriptos. | Trámite regulatorio, fuera del código. |

## 3. Datos de prueba
- `.env.local` (desarrollo) apunta a la **misma base Neon** que `.env.production.local`. Todo lo que se haga en desarrollo escribe en producción.
- No se ejecutó ninguna purga. Antes de abrir al público, revisar en la base real, solo con consultas de lectura, cuentas con email `qa-*@unicreditos.com` o dominios de prueba, y usar `scripts/purge-sandbox-wallet-data.ts` y `scripts/rotate-qa-accounts.ts` con la confirmación `--yes` y la base correcta.
- Separar una base de desarrollo propia (o una rama de Neon) para no repetir esto.

## 4. Decisiones del negocio que siguen abiertas
Método del CFT (hoy TEA × 1,21, que subestima el costo con IVA compuesto), comisiones, tasas por perfil, Mercado Pago por comercio, reglas de entrega del 30 % y texto del botón de arrepentimiento (revisar con asesor legal). Ver `docs/CIERRE-2026-10.md`, sección (d).

## 5. Limpieza hecha en esta auditoría
- Se eliminaron ~4.700 líneas de código sin uso: el admin heredado (incluidas acciones de borrado de usuarios y créditos que nadie llamaba), la carga "sandbox" de la billetera, helpers de BCRA y etiquetas sin referencias, y dos páginas duplicadas (`/login` y `/admin/finanzas/panel-control`, ahora redirecciones permanentes).
- Al borrar la función muerta `createBankAccount` apareció que la función viva `lookupAndCreateBankAccount` no exigía identidad verificada para cargar una cuenta bancaria; se agregó esa guarda.
- Las rutas `/api/wallet/*` se conservan: son el contrato con la app móvil externa (`scripts/gen-mobile-routes.ts`).

## 6. Venta financiada en comercios (anticipo del 30% y liquidación de los viernes)

Circuito (código en `lib/merchant-orders/`, tablas en `lib/merchant-commerce-ddl.ts`, se crean solas en el primer uso):

1. **Catálogo**: el comercio carga productos con precio de contado, stock y foto (`/merchant?tab=catalogo`). Se publican en su vidriera `/red-comercios/<id>`.
2. **Venta**: el comercio arma el carrito y carga el CUIL (o el cliente lo pide online desde la vidriera). Se calcula el anticipo del 30% (redondeado hacia arriba al peso) y el crédito es por el 70% restante, a nombre del cliente. El crédito nace **siempre pendiente**: lo decide la mesa en Originación → Aprobaciones.
3. **Cliente**: firma el contrato y paga el anticipo **a UNICRÉDITOS** (nunca al comercio): QR dinámico de Mercado Pago (se acredita solo por webhook firmado) o transferencia a la cuenta de tesorería con comprobante (la acredita Cobranzas en Comercios → Ventas en comercios).
4. **Entrega**: con firma + anticipo acreditado el cliente ve un código de 6 dígitos; el comercio lo carga al entregar. Ahí el crédito queda vigente y las cuotas arrancan desde la fecha de entrega. No se genera desembolso al cliente.
5. **Liquidación**: cada entrega entra en el lote del **viernes siguiente** (si es feriado, el próximo día hábil). Neto = precio de contado − comisión del comercio. Tesorería transfiere y marca el lote como pagado con el número de operación (Comercios → Liquidaciones). Comprobante imprimible para ambas partes.
6. **Plazo del cliente**: desde que la mesa aprueba, el cliente tiene **10 días** para firmar y pagar el anticipo. Recibe recordatorios a los 2 y a los 7 días; si al día 10 no pagó, la operación se anula sola (no se anula si el anticipo ya entró o si hay una transferencia esperando a tesorería).
7. **Anulaciones y devoluciones**: el comercio puede anular mientras no haya anticipo cobrado; con anticipo cobrado anula solo UNICRÉDITOS (ficha de la operación o anulando la solicitud en la mesa) y queda **"anticipo a devolver"**. Si se cobró por QR, el botón *Reintegrar por Mercado Pago* hace el reintegro total por API; si fue transferencia, tesorería transfiere a la cuenta de origen y carga el número de operación. Un pago que llega después de anular también queda para devolver. El cliente ve el estado y recibe el aviso. Las ventas en comercios no se editan desde la mesa (el monto sale del catálogo).

**Cron diario** `/api/cron/merchant-orders` (08:00 hora argentina, `CRON_SECRET`): actualiza feriados desde api.argentinadatos.com (tabla `bank_holiday`; la lista fija `AR_BANK_HOLIDAYS` es el respaldo), concilia QR de anticipos por si se perdió un webhook, manda recordatorios y vence operaciones, y en días hábiles envía a `soporte@` el resumen de pendientes (liquidaciones a pagar hoy o vencidas, anticipos a revisar, devoluciones, ventas esperando a la mesa).

Pendientes operativos: la titularidad de la cuenta de cobro se valida con ArgenAPI cuando responde, si no la revisa tesorería antes del primer pago.
