'use client'

import { updateMyAvatar } from '@/app/actions/account'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Camera, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

function initialsFrom(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

export function AccountAvatar({
  name,
  email,
  image,
  size = 'md',
  editable = false,
  className,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: 'sm' | 'md' | 'lg'
  editable?: boolean
  className?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const blobRef = useRef<string | null>(null)
  const [preview, setPreview] = useState(image ?? '')
  const [pending, startTransition] = useTransition()

  const [prevImage, setPrevImage] = useState(image ?? '')
  if (prevImage !== (image ?? '')) {
    setPrevImage(image ?? '')
    setPreview(image ?? '')
  }

  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [])

  const box = size === 'lg' ? 'size-16' : size === 'sm' ? 'size-9' : 'size-11'

  const onPick = (file: File | undefined) => {
    if (!file) return
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    const local = URL.createObjectURL(file)
    blobRef.current = local
    setPreview(local)
    startTransition(async () => {
      try {
        const data = new FormData()
        data.set('avatar', file)
        const res = await updateMyAvatar(data)
        if (!res.ok) {
          setPreview(image ?? '')
          toast.error(res.error)
          return
        }
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current)
          blobRef.current = null
        }
        setPreview(res.image)
        toast.success('Foto de perfil actualizada')
        router.refresh()
      } catch (err) {
        setPreview(image ?? '')
        toast.error(err instanceof Error ? err.message : 'No se pudo subir la foto.')
      }
    })
  }

  return (
    <div className={cn('relative shrink-0', className)}>
      <Avatar className={cn(box, 'ring-1 ring-slate-200')}>
        <AvatarImage src={preview || image || ''} alt={name ?? 'Usuario'} />
        <AvatarFallback className="bg-brand-navy-800 text-sm font-semibold text-white">
          {initialsFrom(name, email)}
        </AvatarFallback>
      </Avatar>
      {editable ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              inputRef.current?.click()
            }}
            disabled={pending}
            className="absolute -bottom-1 -right-1 inline-flex size-7 items-center justify-center rounded-full bg-brand-navy-900 text-white shadow-sm ring-2 ring-white hover:bg-brand-navy-800 disabled:opacity-60"
            aria-label="Cambiar foto de perfil"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </button>
        </>
      ) : null}
    </div>
  )
}
