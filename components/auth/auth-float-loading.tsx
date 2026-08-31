export function AuthFloatLoading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col bg-[#F3F5F4]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="px-5 py-5 sm:px-10">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-14">
        <div
          className={`w-full animate-pulse rounded-xl bg-white shadow-[0_18px_50px_rgba(12,22,18,0.10)] ${
            wide ? 'h-[28rem] max-w-5xl' : 'h-80 max-w-[420px]'
          }`}
        />
      </div>
    </div>
  )
}
