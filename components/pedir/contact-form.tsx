'use client'

import { submitPublicInquiry } from '@/app/actions/contact'
import { PedirFooter, PedirHeader } from '@/components/pedir/chrome'
import { BRAND } from '@/lib/brand'
import { useState, useTransition } from 'react'

function ContactFields() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('Consulta sobre préstamo personal')
  const [message, setMessage] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    start(async () => {
      try {
        await submitPublicInquiry({
          kind: 'contacto',
          name,
          email,
          phone: phone || undefined,
          subjectLine: subject,
          message,
        })
        setOk(true)
        setMessage('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo enviar.')
      }
    })
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
        Escribinos a {BRAND.supportEmail} o usá este formulario. Atención remota de lunes a viernes, 9 a 18 hs
        (Argentina). No publicamos WhatsApp ni 0800.
      </p>
      {error ? <div className="lp-alert lp-alert-err mt-5">{error}</div> : null}
      {ok ? (
        <div className="lp-alert lp-alert-ok mt-5">Mensaje enviado. Te respondemos al email indicado.</div>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="lp-field">
          <label className="lp-label" htmlFor="lp-c-name">
            Nombre
          </label>
          <input id="lp-c-name" className="lp-input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-c-email">
              Email
            </label>
            <input
              id="lp-c-email"
              type="email"
              className="lp-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-c-phone">
              Teléfono (opcional)
            </label>
            <input id="lp-c-phone" className="lp-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="lp-field">
          <label className="lp-label" htmlFor="lp-c-subject">
            Asunto
          </label>
          <input id="lp-c-subject" className="lp-input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="lp-field">
          <label className="lp-label" htmlFor="lp-c-msg">
            Mensaje
          </label>
          <textarea
            id="lp-c-msg"
            className="lp-textarea min-h-32"
            required
            minLength={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button type="submit" className="lp-btn lp-btn-primary w-full" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar consulta'}
        </button>
      </form>
    </>
  )
}

export function PedirContactForm() {
  return (
    <>
      <PedirHeader solid />
      <main className="pb-20 pt-28">
        <div className="lp-container max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">Soporte</p>
          <h1 className="lp-display mt-2 text-4xl text-[var(--lp-ink)]">Contacto</h1>
          <div className="mt-2">
            <ContactFields />
          </div>
        </div>
      </main>
      <PedirFooter />
    </>
  )
}

export function PedirContactAppBody() {
  return (
    <div className="lp-app-panel">
      <ContactFields />
    </div>
  )
}
