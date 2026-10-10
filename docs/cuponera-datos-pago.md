# Cuponera: bloque "Datos para pagar" (cuenta de cobro de UNICRÉDITOS)

Rama: `feature/cuponera-datos-pago` (desde `security/hardening-2026-10`). Sin deploy.

## Qué hace
- Cada cupón (4 por hoja A4: talón | línea de corte | cupón de pago) lleva el bloque **Datos para pagar**: banco, titular, CUIT, N° de cuenta corriente, CBU, alias, concepto (código UNICRÉDITOS) y **QR de transferencia**, junto al código de barras y las entidades Pago Fácil / Rapipago / Mercado Pago (texto en recuadro; reemplazable por logos oficiales).
- Los valores salen de **una sola fuente**: `lib/treasury.ts` (variables `TREASURY_*`, solo servidor). `lib/documents/coupon-payment-data.ts` los valida y genera el QR; el componente es solo de presentación (recibe `pay`).

## Regla de seguridad (bloqueo de emisión)
Datos requeridos: banco, titular, CUIT (11 dígitos), N° de cuenta, CBU (22 dígitos), alias (6-20 caracteres), QR (`TREASURY_QR_PAYLOAD`).
- Si falta alguno: la cuponera se muestra como **BORRADOR** con el marcador rojo `DATO PENDIENTE DE CONFIRMAR` (y `QR PENDIENTE DE CONFIRMAR`), con un aviso arriba que lista lo que falta, y **la impresión queda bloqueada** (en `@media print` solo sale la hoja "Cuponera no emitible"). El PDF exportado desde el botón (html2pdf) lleva el aviso de borrador y los marcadores.
- Si no falta nada: sin marcadores, impresión normal.
- Los marcadores solo existen en modo borrador; nunca se imprimen en una cuponera definitiva.

## Cómo cargar los valores (servidor, `.env.local` / Hostinger)
```
TREASURY_ACCOUNT_NUMBER=   # N° de cuenta corriente
TREASURY_CBU=              # 22 dígitos
TREASURY_ALIAS=            # alias de la cuenta
TREASURY_QR_PAYLOAD=       # texto del QR de transferencia (lo entrega el banco/Mercado Pago; no es una imagen)
```
Banco, titular y CUIT salen de `lib/treasury.ts` / `lib/brand.ts` (`NEXT_PUBLIC_BRAND_CUIT`). `scripts/write-prod-env.ts` propaga las variables nuevas al `.env` de producción.
Nota: hoy `lib/treasury.ts` conserva por compatibilidad valores por defecto de CBU y N° de cuenta (otros módulos de tesorería/billetera los usan). Conviene definirlos por entorno y quitar los defaults en una etapa aparte.

## Archivos
`lib/documents/coupon-payment-data.ts` (nuevo), `components/documents/coupon-book-printable.tsx`, `lib/treasury.ts` (+`qrPayload`), `app/dashboard/documentos/cuponera/[loanId]/page.tsx`, `app/actions/customer-documents.ts` (+`pay` en talonario), `components/dashboard/in-app-document-panel.tsx`, `app/globals.css` (bloque `cp-*`, `@page cuponera` A4 margen 8 mm), `.env.example`, `scripts/write-prod-env.ts`, `scripts/tests/cuponera-datos-pago.test.ts`.
