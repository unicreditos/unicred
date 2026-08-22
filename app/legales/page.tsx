import Link from 'next/link'
import { Logo } from '@/components/brand'

export default function LegalesPage() {
  return (
    <main className="min-h-svh bg-background">
      <header className="border-b border-border bg-background"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4"><Logo /><Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Volver al inicio</Link></div></header>
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div><p className="text-sm font-medium text-primary">Información legal</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Términos, condiciones y transparencia</h1><p className="mt-3 text-muted-foreground">Esta información es orientativa y debe ser revisada y aprobada por el área legal de Unipagos antes de operar comercialmente.</p></div>
        <section className="space-y-3"><h2 className="text-xl font-semibold">1. Naturaleza del servicio</h2><p className="leading-7 text-muted-foreground">UniCred es una unidad de negocio de Unipagos. La simulación no constituye una oferta ni garantiza aprobación, desembolso, tasa, plazo o monto. Toda operación queda sujeta a evaluación, disponibilidad, verificación de identidad y aceptación de la documentación contractual aplicable.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">2. Condiciones del crédito</h2><p className="leading-7 text-muted-foreground">Antes de contratar deben informarse de forma clara el capital, cantidad y valor de cuotas, tasa nominal anual (TNA), tasa efectiva anual (TEA), costo financiero total (CFT), impuestos, comisiones, gastos, fecha de vencimiento, consecuencias de mora y mecanismo de cancelación anticipada.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">3. Evaluación crediticia</h2><p className="leading-7 text-muted-foreground">La evaluación puede utilizar información de la Central de Deudores del BCRA y otros datos autorizados. El resultado mostrado por la aplicación es una evaluación automatizada y no reemplaza las obligaciones regulatorias, verificaciones de identidad ni controles internos.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">4. Pagos y comprobantes</h2><p className="leading-7 text-muted-foreground">Actualmente esta versión no tiene conectados Mercado Pago, tarjetas, QR, Pago Fácil ni Rapipago. No debe interpretarse que un pago fue efectuado si no existe confirmación del proveedor y un comprobante emitido por el sistema. Las opciones habilitadas se mostrarán únicamente cuando estén integradas y verificadas.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">5. Privacidad y contacto</h2><p className="leading-7 text-muted-foreground">Los datos personales deben procesarse con una política de privacidad, consentimiento, medidas de seguridad y canales de atención aprobados por Unipagos y adaptados a la normativa argentina aplicable. Esta pantalla no reemplaza esos documentos regulatorios.</p></section>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Estado de esta versión: entorno de desarrollo/prototipo funcional. No ofrece desembolsos ni medios de pago reales hasta completar contratos, habilitaciones, revisión legal e integraciones.</div>
      </article>
    </main>
  )
}
