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
