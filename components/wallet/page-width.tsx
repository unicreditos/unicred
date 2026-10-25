/** Ancho de lectura de cada pantalla dentro del panel: formularios angostos, tableros anchos. */
export function PageWidth({ width = 'max-w-5xl', children }: { width?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full ${width}`}>{children}</div>
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
  leading,
}: {
  /** Solo se muestra para los pasos de una secuencia ("Paso 1"); en lo demás, la sección ya la indica el rastro de la barra superior. */
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  leading?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0 max-w-2xl">
          {eyebrow && /^Paso \d/.test(eyebrow) ? <p className="mb-1 text-sm font-medium text-primary">{eyebrow}</p> : null}
          <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
