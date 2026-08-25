'use client'

import { submitPublicInquiry } from '@/app/actions/contact'
import { useActionState } from 'react'

export function PublicInquiryForm({
  kind,
  defaultSubject,
  extraFields,
}: {
  kind: 'contacto'
  defaultSubject?: string
  extraFields?: React.ReactNode
}) {
  const [state, action, pending] = useActionState(
    async (_prev: { ok?: boolean; error?: string } | null, form: FormData) => {
      try {
        await submitPublicInquiry({
          kind,
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          subjectLine: String(form.get('subject') ?? defaultSubject ?? 'Consulta'),
          message: String(form.get('message') ?? ''),
        })
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    },
    null,
  )

  if (state?.ok) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Recibimos tu mensaje. Te respondemos a la casilla que indicaste.
      </p>
    )
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-700">Nombre completo</span>
        <input
          name="name"
          required
          type="text"
          placeholder="Juan Pérez"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-brand-primary/30 focus:ring-2"
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-700">Correo</span>
        <input
          name="email"
          required
          type="email"
          placeholder="vos@email.com"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-brand-primary/30 focus:ring-2"
        />
      </label>
      {extraFields}
      <label className="space-y-1.5 sm:col-span-2">
        <span className="text-xs font-semibold text-slate-700">Asunto</span>
        <input
          name="subject"
          defaultValue={defaultSubject}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-brand-primary/30 focus:ring-2"
        />
      </label>
      <label className="space-y-1.5 sm:col-span-2">
        <span className="text-xs font-semibold text-slate-700">Mensaje</span>
        <textarea
          name="message"
          required
          rows={6}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-brand-primary/30 focus:ring-2"
        />
      </label>
      {state?.error ? (
        <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
      >
        {pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}
