import Link from 'next/link'
import { Logo } from '@/components/brand'

const topics = [
  ['¿Cómo solicito un crédito?', 'Creá una cuenta, completá tus datos y usá el simulador. La solicitud queda sujeta a evaluación y no implica aprobación automática.'],
  ['¿Qué significa el resultado BCRA?', 'Es una referencia calculada a partir de información consultada en la Central de Deudores. No es una promesa de otorgamiento ni reemplaza una evaluación completa.'],
  ['¿Puedo pagar una cuota?', 'En esta versión todavía no hay un proveedor de pagos conectado. No ingreses datos de tarjeta ni transfieras dinero desde esta aplicación.'],
  ['¿Dónde encuentro mis documentos?', 'La generación de contratos, recibos y comprobantes de desembolso se habilitará cuando la operación real y sus integraciones estén aprobadas.'],
]

export default function AyudaPage() {
  return <main className="min-h-svh bg-background"><header className="border-b border-border"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4"><Logo /><Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Volver al inicio</Link></div></header><article className="mx-auto max-w-3xl px-4 py-12"><p className="text-sm font-medium text-primary">Centro de ayuda</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Respuestas claras, sin promesas falsas.</h1><p className="mt-3 text-muted-foreground">Estamos preparando los canales operativos y de atención para el lanzamiento. Mientras tanto, esta es la información disponible.</p><div className="mt-10 space-y-4">{topics.map(([title, body]) => <section key={title} className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold text-card-foreground">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></section>)}</div><div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-semibold">¿Necesitás asistencia?</h2><p className="mt-2 text-sm text-muted-foreground">El canal de atención al cliente debe definirse y publicarse antes de la operación comercial. No mostramos un teléfono o correo inventado.</p></div></article></main>
}
