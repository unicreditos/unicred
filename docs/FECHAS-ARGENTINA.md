# Fechas en hora de Argentina

Rama: `fix/fechas-argentina-2026-10` (desde `security/hardening-2026-10`). Sin desplegar, sin tocar la base real.

## Causa

El servidor (Vercel) corre en UTC. Todo lo que calcula "el dia" con `getDate()`, `setHours()`, `setMonth()`,
`toISOString().slice(0, 10)` o `new Date('AAAA-MM-DD')` usa el dia UTC. Entre las 21:00 y las 23:59 de Argentina,
UTC ya es el dia siguiente. Las columnas son todas `timestamptz` (el instante guardado es correcto); lo que fallaba
era calcular, agrupar y comparar por dia. Los 2 tests rojos de `dashboard-date-range` tenian la misma causa: las funciones
y los tests dependian del huso de la maquina (pasaban en UTC y fallaban en la PC de Argentina).

## Solucion

`lib/date-ar.ts` es la unica fuente para: hoy en AR, inicio/fin de dia y de mes, sumar dias/meses (recorte a fin de mes),
dias CIVILES de diferencia/atraso, parseo de fechas sin hora como dia local, formato dd/mm/aaaa, AAAAMMDD y offset ISO.
Usa `Intl` con `timeZone`, nunca offsets a mano. Vencimientos nuevos = fecha civil a las 00:00 AR.

## Inventario

| Archivo / funcion | Tabla.columna | Tipo | Que fallaba | Severidad | Estado |
|---|---|---|---|---|---|
| `lib/admin-desk/build-state.ts` `dayKey`, `emptySeries` | loan.createdAt, payment.paidAt, disbursement.creditedAt (series del panel) | timestamptz | Agrupaba por dia UTC y el "hoy" del grafico era UTC: lo ingresado 21:00-23:59 AR contaba el dia siguiente (el 10/10 de Arias) | Alta | Corregido |
| `lib/admin-desk/build-state.ts` `mapInstallmentStatus`, dias de mora | installment.dueDate | timestamptz | Vencida apenas pasaba el instante guardado, dias = ms/86400000 | Alta | Corregido (dias civiles AR) |
| `lib/loan-schedule.ts` `buildInstallmentValues` | installment.dueDate | timestamptz | `setMonth` sobre el instante: 31/01 + 1 mes = 03/03; mes calculado en UTC | Alta | Corregido |
| `lib/legal/mora.ts` `daysPastDue`, `startOfDay`, `addMonths`, `asDate` | installment.dueDate | timestamptz | `setHours` en UTC: atraso, gracia de 30 dias e intimacion corridos hasta 1 dia; `new Date('AAAA-MM-DD')` = UTC | Alta | Corregido |
| `lib/legal/expediente.ts` `syncOverdueInstallments` | installment.status/dueDate | timestamptz | "Hoy 00:00" en UTC: marcaba vencida la cuota el mismo dia de su vencimiento | Alta | Corregido |
| `app/actions/documents.ts` refinanciacion | installment.dueDate | timestamptz | Inicio de dia UTC + `addMonths` | Media | Corregido |
| `lib/arca/wsfe.ts` `yyyymmdd` | comprobante ARCA | texto | Fecha de factura = dia UTC: despues de las 21:00 AR sale con fecha de manana (ARCA puede rechazar) | Alta | Corregido |
| `lib/arca/wsaa.ts` `argTime` | ticket WSAA | texto | Restaba 3 h a mano | Baja | Corregido (Intl) |
| `lib/admin-desk/mutate.ts`, `app/actions/banking.ts` | disbursement.receiptNumber `DES-AAAAMMDD-...` | text unique | Numero de comprobante con el dia UTC | Media | Corregido (los ya emitidos no se reescriben, ver SQL paso 5) |
| `lib/coupon.ts` `dueStamp` | codigo de cupon (vencimiento) | texto | Dia UTC en el codigo | Media | Corregido |
| `app/actions/admin.ts` edicion manual de acreditacion | loan.disbursedAt | timestamptz | `new Date('2026-10-09')` = 08/10 21:00 AR | Alta | Corregido |
| `app/actions/admin.ts` / `lib/bcra-market.ts` variables BCRA | bcra_variable.effectiveDate | timestamptz | `new Date(fecha)` y `toISOString().split('T')` | Media | Corregido, lectura compatible con datos viejos (`dateOnlyKey`) |
| `lib/admin-desk/date-filter.ts` (rangos del dashboard) | n/a | n/a | Rangos con `new Date(y, m, d)` y `setHours` del huso de la maquina; fechas sin hora como UTC (los 2 tests rojos) | Alta | Corregido |
| `lib/notifications.ts`, `app/actions/loans.ts` `getMyInstallments` | installment.dueDate | timestamptz | "Hoy"/semana/60 dias en UTC; `toLocaleDateString` sin huso | Media | Corregido |
| `lib/legal/withdrawal.ts` | loan_contract.acceptedAt | timestamptz | `setDate` en UTC | Baja | Corregido |
| `lib/payments/installment-mp-qr.ts`, `installment-mp-ticket.ts` | payment.expiresAt | timestamptz | Gracia = vencimiento + N*24 h | Baja | Corregido (hasta fin del dia AR) |
| `lib/mobile/data.ts` `daysUntilDue` | installment.dueDate | timestamptz | `ceil(ms/86400000)` | Media | Corregido |
| `app/admin/finanzas/analiticas/page.tsx` | varias | timestamptz | Restaba 3 h a mano | Baja | Corregido (Intl) |
| `lib/didit-expected.ts`, `app/actions/register.ts`, `app/actions/loans.ts` | profile.birthDate | text (AAAA-MM-DD) | Mayoria de edad con `setFullYear`/`new Date` del huso del servidor | Media | Corregido (fecha civil) |
| `app/merchant/_client.tsx`, `components/*` | n/a | n/a | `toLocaleDateString('es-AR')` sin `timeZone`; meses por huso del navegador | Baja | Corregido |
| `lib/mobile/ops.ts` y APIs moviles | varias | timestamptz | Devuelven `toISOString()` (UTC con "Z") | Info | Sin cambios: es un instante correcto; la app debe mostrarlo en hora de Argentina |
| `lib/kyc-validity.ts` | kyc.reviewedAt | timestamptz | `setUTCMonth` (vigencia de 12 meses por instante) | Info | Sin cambios: es una duracion, no un dia civil |
| Pantallas del admin con `fdate()`/`fdatetime()`, `docDate*`, `formatDateArg` | n/a | n/a | Ya usaban `America/Argentina/Buenos_Aires` | OK | Sin cambios |

## Datos ya guardados

Ver `docs/sql-propuestas/2026-10-09_fechas_argentina_PROPUESTA.sql` (no aplicada; todo solo lectura salvo el paso 3, que va con
backup, vista previa y `ROLLBACK` por defecto). El instante de `loan.createdAt` es correcto, asi que el credito de Arias no se modifica.

## Pendiente

- Los vencimientos de cuotas viejas guardan la hora de acreditacion (se muestran bien en AR); no hace falta tocarlos salvo los del paso 2 del SQL.
- La app movil debe formatear los instantes ISO en America/Argentina/Buenos_Aires.
- Los numeros `DES-AAAAMMDD` ya emitidos entre 21:00 y 23:59 AR llevan el dia siguiente (identificadores, no se reescriben).