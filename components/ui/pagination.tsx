import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/** Paginación única para todas las tablas y listados: "Mostrando 26–50 de 120" + Anterior / Siguiente. */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  href,
}: {
  page: number
  pages: number
  total?: number
  pageSize?: number
  href: (page: number) => string
}) {
  if (pages <= 1) return null
  const range =
    total != null && pageSize != null
      ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`
      : `Página ${page} de ${pages}`
  return (
    <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="tnum text-muted-foreground">{range}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
