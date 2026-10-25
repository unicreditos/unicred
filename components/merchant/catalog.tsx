'use client'

import { saveProduct, setProductActive } from '@/app/actions/merchant-commerce'
import { btnGhost, btnPrimary, Empty, fieldClass, Panel, type Commerce, type CommerceProduct } from '@/components/merchant/shared'
import { formatARS } from '@/lib/finance'
import { DOWN_PAYMENT_RATE } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { ImagePlus, Loader2, PackagePlus, Pencil, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

/** Achica la foto en el navegador (máx. 640 px, JPEG) para guardarla liviana. */
async function resizeImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length < 420_000) return url
  }
  throw new Error('La foto es demasiado pesada.')
}

type Draft = { id?: string; name: string; sku: string; category: string; description: string; price: string; stock: string; image: string | null; active: boolean }

const emptyDraft: Draft = { name: '', sku: '', category: '', description: '', price: '', stock: '', image: null, active: true }

function ProductForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const router = useRouter()
  const [d, setD] = useState<Draft>(initial)
  const [pending, start] = useTransition()
  const price = Number(d.price.replace(/\./g, '').replace(',', '.'))
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value })
  return (
    <form
      className="grid gap-4 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-[9rem_1fr] sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveProduct({
            id: d.id,
            name: d.name,
            sku: d.sku,
            category: d.category,
            description: d.description,
            price,
            stock: d.stock === '' ? null : Number(d.stock),
            image: d.image,
            active: d.active,
          })
          if (r.ok) {
            toast.success(d.id ? 'Producto actualizado' : 'Producto agregado al catálogo')
            onDone()
            router.refresh()
          } else toast.error(r.error)
        })
      }}
    >
      <label className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background text-center text-xs text-muted-foreground">
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <ImagePlus className="mb-1 h-6 w-6" aria-hidden /> Foto (opcional)
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              setD({ ...d, image: await resizeImage(f) })
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'No se pudo leer la foto')
            }
          }}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Nombre del producto
          <input required minLength={2} maxLength={120} value={d.name} onChange={set('name')} className={cn(fieldClass, 'mt-1')} placeholder="Ej.: Heladera No Frost 380 L" />
        </label>
        <label className="text-sm font-medium">
          Precio de contado (ARS)
          <input required inputMode="decimal" value={d.price} onChange={set('price')} className={cn(fieldClass, 'mt-1 font-mono')} placeholder="899999" />
        </label>
        <label className="text-sm font-medium">
          Stock <span className="font-normal text-muted-foreground">(vacío = sin control)</span>
          <input inputMode="numeric" value={d.stock} onChange={set('stock')} className={cn(fieldClass, 'mt-1 font-mono')} placeholder="—" />
        </label>
        <label className="text-sm font-medium">
          Categoría
          <input maxLength={60} value={d.category} onChange={set('category')} className={cn(fieldClass, 'mt-1')} placeholder="Electrodomésticos" />
        </label>
        <label className="text-sm font-medium">
          Código / SKU
          <input maxLength={40} value={d.sku} onChange={set('sku')} className={cn(fieldClass, 'mt-1 font-mono')} placeholder="HEL-380" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Descripción
          <textarea maxLength={600} value={d.description} onChange={set('description')} rows={2} className={cn(fieldClass, 'mt-1 h-auto py-2')} />
        </label>
        {price > 0 ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            El cliente paga {formatARS(Math.ceil(price * DOWN_PAYMENT_RATE))} de anticipo a UNICRÉDITOS y financia {formatARS(price - Math.ceil(price * DOWN_PAYMENT_RATE))}.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {d.id ? 'Guardar cambios' : 'Agregar al catálogo'}
          </button>
          <button type="button" className={btnGhost} onClick={onDone}>
            Cancelar
          </button>
        </div>
      </div>
    </form>
  )
}

function toDraft(p: CommerceProduct): Draft {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku ?? '',
    category: p.category ?? '',
    description: p.description ?? '',
    price: String(p.price).replace('.', ','),
    stock: p.stock == null ? '' : String(p.stock),
    image: p.image,
    active: p.active,
  }
}

export function CatalogTab({ data }: { data: Commerce }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [q, setQ] = useState('')
  const [pending, start] = useTransition()
  const products = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? data.products.filter((p) => `${p.name} ${p.sku ?? ''} ${p.category ?? ''}`.toLowerCase().includes(t)) : data.products
  }, [data.products, q])

  return (
    <div className="space-y-5">
      <Panel
        eyebrow="Catálogo"
        title={`${data.products.filter((p) => p.active).length} productos a la venta`}
        action={
          editing ? null : (
            <button type="button" className={btnPrimary} onClick={() => setEditing(emptyDraft)}>
              <PackagePlus className="h-4 w-4" aria-hidden /> Nuevo producto
            </button>
          )
        }
      >
        <p className="text-sm text-muted-foreground">
          Lo que cargues acá lo podés vender en cuotas desde <b>Nueva venta</b> y aparece en tu vidriera pública de UNICRÉDITOS. El precio es el de contado: el cliente paga el 30% de anticipo y financia el resto.
        </p>
        {editing ? <div className="mt-4"><ProductForm initial={editing} onDone={() => setEditing(null)} /></div> : null}
      </Panel>

      {data.products.length ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'pl-9')} placeholder="Buscar por nombre, código o categoría" aria-label="Buscar en el catálogo" />
        </div>
      ) : null}

      {products.length === 0 ? (
        <Empty title={data.products.length ? 'Sin resultados' : 'Tu catálogo está vacío'}>
          {data.products.length ? 'Probá con otra búsqueda.' : 'Agregá tu primer producto para empezar a vender en cuotas.'}
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <li key={p.id} className={cn('flex flex-col overflow-hidden rounded-2xl border border-border bg-card', !p.active && 'opacity-60')}>
              <div className="aspect-[4/3] bg-muted">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-4xl font-extrabold text-muted-foreground/40">{p.name.slice(0, 1)}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug text-foreground">{p.name}</h3>
                  {p.sku ? <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{p.sku}</span> : null}
                </div>
                {p.category ? <p className="mt-0.5 text-xs text-muted-foreground">{p.category}</p> : null}
                <p className="mt-3 font-display text-2xl font-extrabold tabular-nums">{formatARS(p.price)}</p>
                <p className="text-xs text-muted-foreground">
                  Anticipo {formatARS(Math.ceil(p.price * DOWN_PAYMENT_RATE))} · stock {p.stock == null ? 'sin control' : p.stock}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button type="button" className={btnGhost} onClick={() => setEditing(toDraft(p))}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={btnGhost}
                    onClick={() =>
                      start(async () => {
                        const r = await setProductActive(p.id, !p.active)
                        if (r.ok) router.refresh()
                        else toast.error(r.error)
                      })
                    }
                  >
                    {p.active ? 'Pausar' : 'Reactivar'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
