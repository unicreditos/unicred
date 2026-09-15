# UNICRÉDITOS — sistema visual

Producto: crédito de consumo digital en Argentina. Una sola voz de **público → auth → dashboard → admin → merchant**.
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

Ámbar y rojo **no** se usan de adorno. Cian e índigo son aliases deprecados hacia verdes/navy.
Naranja (`#FF5722`, `#F5A623`) no entra en chrome de producto. El isotipo usa `brand-primary`.

`.uc-gradient-*` es **legacy**. Preferí navy sólido, vidrio del hero, o `brand-primary`.

## Primitivas

- **BrandLogo / BrandMark** — círculo navy + `$` verde; wordmark Geist/Jakarta, no Impact.
- **SectionCard** (`dashboard-kit`) — panel de app: header muted + cuerpo.
- **MetricTile** (`workspace-shell`) — KPI con `tabular-nums`. Amber/rose solo por `tone`.
- **StatusChip / StatusPill** — mismos tonos: success / warning / danger / muted. Sin sky/teal/violet.
- **Hero de vidrio** (`app/page.tsx` + `LoanSimulator variant="glass"`) — foto primero.
- **WorkspaceShell** — acento `brand-primary` en nav activa.
- **PublicPageShell / PageSection / FeatureCard** — páginas públicas.
- **PublicCtaBanner** — único momento navy de marketing.
- **AuthFloatLayout** — formularios sólidos. CTA `brand-primary`.
- **EmptyState** — vacío dashed, mismo en dashboard / admin / merchant.

## Números de costo

Cuota, TNA, TEA, CFT y montos: `tabular-nums`. Contraste alto sobre vidrio y sólido.

## Qué no se toca

Underwriting, pagos, ledger y auth backend. Los documentos imprimibles pueden seguir
usando tinta de papelería; la UI en pantalla usa este sistema.
