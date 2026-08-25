# UNICRÉDITOS

Plataforma de créditos y cobranzas de RM International Group S.A.S. Next.js 16 (App Router),
Postgres en Neon con Drizzle ORM, autenticación con Better Auth y cobranza por
Mercado Pago.

Dominio canónico: **https://unicreditos.com**. Alias de marca (redirigen al canónico):
unicreditos.com.ar, unicreditos.store, unicreditos.online.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completá los valores
npm run db:push              # crea tablas e índices
npm run db:seed              # productos de crédito base
npm run dev
```

La app queda en `http://localhost:3000`.

Para darte permisos de administración sobre una cuenta ya registrada:

```bash
npm run make-admin -- tu-mail@dominio.com
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y arranque de producción. |
| `npm run check` | Typecheck + ESLint. |
| `npm run test` | Pruebas de dominio (tasas, estados, tabs, env). |
| `npm run smoke` | HTTP contra localhost o `SMOKE_BASE`. |
| `npm run preflight` | test + typecheck + lint + prod:check. |
| `npm run prod:check` | Variables de producción, sin imprimir secretos. |
| `npm run db:push` | Crea las tablas e índices que falten. |
| `npm run db:seed` | Carga los productos de crédito. |
| `npm run db:verify` | Compara el schema de Drizzle contra la base real y lista las diferencias. |
| `npm run db:verify:fix` | Aplica las diferencias detectadas (índices, `NOT NULL`). |
| `npm run make-admin` | Promueve un usuario a administrador. |

## Variables de entorno

Están documentadas una por una en `.env.example`. Las obligatorias son
`DATABASE_URL`, `BETTER_AUTH_SECRET` y `NEXT_PUBLIC_SITE_URL`: si falta alguna,
el servidor de producción no arranca (ver `instrumentation.ts` y `lib/env.ts`).

Las opcionales degradan funcionalidad en silencio, así que conviene tenerlas:

- Sin `MERCADO_PAGO_ACCESS_TOKEN` no se pueden generar links de pago.
- Sin `MERCADO_PAGO_WEBHOOK_SECRET` el webhook rechaza todas las notificaciones
  y las cuotas nunca se acreditan.
- Sin `RESEND_API_KEY` no salen los correos de recuperación de contraseña.

Generá el secreto de sesiones con `openssl rand -base64 48`. Nunca reutilices el
de desarrollo en producción: rotarlo invalida todas las sesiones activas.

## Cobranza por Mercado Pago

El único camino por el que una cuota se marca como pagada es el webhook
`POST /api/webhooks/mercadopago`. No existe acreditación manual desde el panel
del cliente; la corrección manual vive en el panel de administración.

En el panel de Mercado Pago hay que configurar:

- URL de notificación: `https://TU-DOMINIO/api/webhooks/mercadopago`
- Evento: `payment`
- Copiar la clave secreta al `MERCADO_PAGO_WEBHOOK_SECRET`

El webhook valida la firma HMAC, bloquea la fila del pago (`SELECT … FOR UPDATE`)
y usa números de recibo determinísticos, así que los reintentos de Mercado Pago
no duplican acreditaciones.

## Checklist de despliegue

1. `npm run preflight` y `npm run build` sin errores.
2. DNS: A/ALIAS de `unicreditos.com` al host. Los alias .com.ar/.store/.online redirigen solos.
3. Cargar las variables de `.env.example` en el hosting (`NEXT_PUBLIC_SITE_URL=https://unicreditos.com`).
4. `npm run db:push` y `npm run db:verify` contra la base de producción.
5. Webhooks: `https://unicreditos.com/api/webhooks/mercadopago` y `/api/webhooks/didit`.
6. Verificar dominio en Resend (casillas @unicreditos.com) antes de mail transaccional.
7. `ALLOW_SESSION_OVERRIDE` apagado. Token de Mercado Pago live (`APP_USR-`), no `TEST-`.
8. Circuito: registro → KYC → solicitud → aprobación → desembolso → cobro → recibo.

## Estructura

```
app/            Rutas (App Router), server actions en app/actions, APIs en app/api
components/     UI. Los *-client.tsx y los que usan hooks son Client Components
lib/            Dominio: schema de DB, auth, ledger, Mercado Pago, BCRA, labels
scripts/        Utilidades de base de datos (tsx)
proxy.ts        Chequeo optimista de sesión para rutas privadas
instrumentation.ts  Validación de entorno al arrancar el servidor
```

## Notas de arquitectura

- **Ledger**: todo movimiento de saldo pasa por `lib/bank/engine.ts`, que usa
  partida doble dentro de una transacción con bloqueo de fila y validación de
  saldo. No escribas balances directamente.
- **Estados de crédito**: las transiciones válidas están en `lib/loan-state.ts`.
  Cualquier cambio de estado tiene que pasar por `assertTransition`.
- **Etiquetas de UI**: los enums de la base se traducen en `lib/labels.ts`. No
  muestres valores crudos en pantalla.
