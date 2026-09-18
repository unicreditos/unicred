import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold">No encontramos ese expediente</h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        El recurso no existe en el recorte mock de Argentina, o el ID está mal formado.
      </p>
      <Link href="/admin" className="mt-6 text-[13.5px] font-semibold text-brand">
        Volver a la torre de control
      </Link>
    </div>
  );
}
