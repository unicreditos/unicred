# UNICRÉDITOS Admin Backoffice

Backoffice de crédito **personal y consumo en Argentina** (operación UNICRÉDITOS). Originación, KYC Didit, mesa de crédito, desembolso manual a CBU, cobranzas MercadoPago + transferencia, y cartera en ARS.

No hay gestión de países ni operatoria multi-país. No hay interés punitivo. El desembolso es siempre manual.

## Stack

- Next.js App Router (TypeScript strict)
- Tailwind CSS v4
- Lucide icons
- Recharts (dashboard / analítica / finanzas)
- Datos 100% mock, mutaciones en memoria

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrí [http://127.0.0.1:43123](http://127.0.0.1:43123). `/` redirige a `/admin`.

Atajo **Ctrl+K** / **Cmd+K**: paleta para saltar a módulos, clientes, créditos y solicitudes.

```bash
npm run build
```

## Locale

- `es-AR`
- Importes: `$ 1.250.000`
- Fechas: `dd/mm/yyyy`
- Moneda: ARS
- Zona: `America/Argentina/Buenos_Aires`

## Módulos

**Control** — Dashboard (torre de control), Analítica  
**Originación** — Solicitudes, Créditos, Clientes, Identidad/KYC, Comercios  
**Cobranzas y tesorería** — Aprobaciones, Cobranzas, Pagos, Desembolsos, Cartera activa, Comprobantes, Finanzas, Cuentas CBU  
**Riesgo** — Riesgo/CENDEU, Variables BCRA  
**Sistema** — Contratos, Soporte, Auditoría, Productos, Operadores, Configuración  

Fichas: `/admin/creditos/[id]`, `/admin/solicitudes/[id]`, `/admin/clientes/[id]`, `/admin/comercios/[id]`, `/admin/pagos/[id]`.

Estados de crédito: En evaluación (`pending`), Calificado (`approved`), Rechazado (`rejected`), Vigente (`active`), Cancelado (`paid`), Anulado (`cancelled`).

## Arquitectura de datos

```
lib/domain/types.ts          # modelo de dominio
lib/data/contracts.ts        # interfaz AdminDataSource
lib/data/mock/seed.ts        # recorte AR de ejemplo
lib/data/mock/source.ts      # implementación in-memory + mutaciones
lib/data/client.ts           # getAdminDataSource() + useAdmin()
```

Las páginas **no** importan el mock. Consumen `useAdmin()` / `getAdminDataSource()`.

## Cómo reemplazar los mocks por unicreditos/unicred

1. Implementá `AdminDataSource` contra server actions (o Route Handlers) del repo `unicreditos/unicred`.
2. En `lib/data/client.ts` cambiá el factory:

```ts
import { unicredSource } from "@/lib/data/unicred"; // tu adapter

export function getAdminDataSource(): AdminDataSource {
  return unicredSource;
}
```

3. Mantené las mismas firmas (`approveApplication`, `markDisbursed`, `matchTransfer`, `decideKyc`, etc.). El UI no tiene que enterarse si el store es memoria o Postgres.
4. Si las mutaciones pasan a ser server actions, envolvélas en el adapter y, si hace falta, invalidá el snapshot (el `subscribe` del contrato sirve para un store cliente o para un SWR/React Query).
5. No hace falta tocar `app/admin/**` salvo campos nuevos del servidor.

El seed mock es deliberadamente rico (clientes, comercios, Didit, CENDEU, BCRA, CBU, MercadoPago) para cablear pantalla por pantalla.
