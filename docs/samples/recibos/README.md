# Modelos de recibo — muestras

| Archivo | Uso en producto |
|---------|-----------------|
| `comprobante-pago-ej.pdf` | **Ticket de servicios** (¡Pago exitoso!): `ServicePaymentTicketPrintable` |
| `factura-muestra.pdf` / `ticket-muestra.pdf` | Referencia fiscal Factura A (comercios) |
| `pago-iva.pdf` / `pago-general-ejemplo.pdf` | Referencia VEP / transferencia |

- UI éxito: `components/payments/services-desk.tsx`
- Descarga: `/dashboard/documentos/recibo/[id]` → ticket (no membrete de cuota)
