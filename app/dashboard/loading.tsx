export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando tu panel…</span>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2.5">
          <div className="h-7 w-56 rounded-lg bg-muted" />
          <div className="h-3.5 w-72 rounded-full bg-muted" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-muted" />
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-muted" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </div>
            <div className="h-7 w-32 rounded-lg bg-muted" />
            <div className="h-3 w-20 rounded-full bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-lg bg-muted" />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-8">
          <div className="h-4 w-48 rounded-full bg-muted" />
          <div className="h-3 w-72 rounded-full bg-muted" />
          <div className="space-y-2.5 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                <div className="h-3.5 flex-1 rounded-full bg-muted" />
                <div className="hidden h-3.5 w-24 rounded-full bg-muted sm:block" />
                <div className="h-6 w-20 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="h-4 w-40 rounded-full bg-muted" />
            <div className="mx-auto h-36 w-36 rounded-full bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-14 rounded-xl bg-muted" />
              <div className="h-14 rounded-xl bg-muted" />
            </div>
          </div>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="h-4 w-32 rounded-full bg-muted" />
            <div className="h-2.5 w-full rounded-full bg-muted" />
            <div className="h-3 w-40 rounded-full bg-muted" />
            <div className="h-9 w-full rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
