# Configuracion y contenido (prototipo)

Menu admin `Configuracion y contenido` (/admin/contenido): Comisiones y tasas, Textos de la web, Documentacion legal, Parametros, Historial.

- Tablas: `site_config_item`, `site_config_version` (historial inmutable por trigger). SQL manual: `scripts/sql/2026-10-10_06_site_config.sql` (regenerar con `scripts/gen-site-config-sql.ts`).
- Permisos: `content.edit`, `content.publish`, `pricing.publish` (el gerente solo edita).
- Flujo: borrador -> en revision -> aprobado (segundo admin en claves sensibles) -> publicado; reauth para publicar; vuelta atras = nuevo borrador desde version vieja.
- Lectura: `getSetting(key)` (lib/site-config/read.ts), cache corta + revalidacion al publicar; sin valor publicado => default del codigo. Kill switch: SITE_CONFIG_DB_READ=off.
- Cableado de ejemplo: `home.hero_subtitle` y `/legal/documentos`. Comisiones/tasas/CFT NO estan cableadas a los calculos (`wired: false`); nunca se muestran publicas sin version publicada con "visible en la web publica".

## Plan para cablear tasas (pendiente, requiere decision de Angel y abogado)
1. Leer `pricing.products` con getSetting en lib/loan-rates/lib/finance solo para solicitudes NUEVAS.
2. Guardar en cada contrato/solicitud un snapshot (version + hash) de tasa y comisiones al firmar: cambiar tasas jamas altera prestamos existentes.
3. Flag por clave antes de activar; probar simulador vs. valores del codigo.
Riesgos: cache desfasada entre instancias, tasas aprobadas sin revision legal, CFT sin metodo aprobado.
