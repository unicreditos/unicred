export default function Loading() {
  return (
    <div className="min-h-svh animate-pulse bg-background" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando UNICRÉDITOS…</span>

      <div className="h-9 w-full bg-muted" />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="h-8 w-36 rounded-lg bg-muted" />
          <div className="hidden items-center gap-6 md:flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3.5 w-20 rounded-full bg-muted" />
            ))}
          </div>
          <div className="h-8 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl space-y-4">
          <div className="h-6 w-40 rounded-full bg-muted" />
          <div className="h-11 w-full rounded-xl bg-muted" />
          <div className="h-11 w-4/5 rounded-xl bg-muted" />
          <div className="h-4 w-3/4 rounded-full bg-muted" />
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-44 rounded-lg bg-muted" />
            <div className="h-10 w-36 rounded-lg bg-muted" />
          </div>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
            >
              <div className="h-10 w-10 rounded-xl bg-muted" />
              <div className="h-4 w-2/3 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="h-3 w-5/6 rounded-full bg-muted" />
                <div className="h-3 w-4/6 rounded-full bg-muted" />
              </div>
              <div className="h-20 rounded-xl bg-muted" />
              <div className="h-9 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
