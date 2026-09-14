# UNICRÉDITOS — sistema visual (Fase 1)

Producto: crédito de consumo digital en Argentina. Una sola voz de **público → auth → app**.
Paleta corta, números tabulares, español `es-AR`. No inventar claims regulatorios.

## Tokens canónicos (`app/globals.css`)

| Rol | Token | Hex |
| --- | --- | --- |
| Marca | `brand-primary` | `#20BD5A` |
| Marca oscura | `brand-primary-700` / `brand-royal` | `#157A3B` |
| Neutro ink | `brand-navy` / `foreground` | `#0C1612` |
| Superficie | `background` | `#F7F8F6` |
| Card | `card` | `#FFFFFF` |
| Estado OK | `success` / `brand-primary` | solo éxito real |
| Estado aviso | `warning` / amber | solo mora, pendiente, riesgo |
| Estado error | `destructive` / rose | solo rechazo, fallo, alerta |

Ámbar y rojo **no** se usan de adorno. Cian e índigo quedaron deprecados: los aliases
`brand-cian*` y `brand-indigo` apuntan a verdes/neutros para no romper clases viejas.
No introducir naranja (`#FF5722`, `#F5A623`) en chrome público ni auth.

`.uc-gradient-navy` / `.uc-gradient-card` / `.uc-text-gradient` son **legacy**.
En superficies de producto preferí navy sólido, vidrio del hero, o `brand-primary`.

## Primitivas

- **SectionCard** (`dashboard-kit`) — panel de app: header muted + cuerpo. Dashboard / admin.
- **MetricTile** (`workspace-shell`) — KPI con `tabular-nums`. Amber/rose solo por `tone`.
- **Hero de vidrio** (`app/page.tsx` + `LoanSimulator variant="glass"`) — foto primero;
  el simulador es translúcido, no un Card opaco. Contraste navy sobre el vidrio.
- **WorkspaceShell** — acento `brand-primary` en nav activa (inset bar), no arcoíris.
- **PublicPageShell** / **PageSection** / **FeatureCard** — páginas públicas. Ritmo
  plano, pocos bordes, sin gradiente cian.
- **PublicCtaBanner** — único momento navy de marca en el sitio público.
- **AuthFloatLayout** — formularios **sólidos** (blanco, sombra suave). CTA `brand-primary`.

## Números de costo

Cuota, TNA, TEA, CFT y montos van siempre con `tabular-nums` (y `font-mono` si el
contexto ya lo usa). Contraste alto sobre vidrio (`text-brand-navy`) y sobre sólido.

## Fuera de esta fase

Dashboard cliente en profundidad, mesas admin, merchant, campaña de borrar
`summary-cards`, y cualquier cambio de underwriting / pagos / ledger / auth backend.
