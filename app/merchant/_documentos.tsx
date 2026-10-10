"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Item = { type: string; label: string; state: "missing" | "uploaded" | "approved" | "observed"; fileName: string | null; note: string | null }
type Msg = { id: string; from: "admin" | "merchant"; author: string; kind: string; body: string; requestedDocType: string | null; hasDocument: boolean; createdAt: string; readAt: string | null }

const STATE: Record<Item["state"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  missing: { label: "Falta", variant: "destructive" },
  uploaded: { label: "Enviado, en revisión", variant: "secondary" },
  approved: { label: "Aprobado", variant: "default" },
  observed: { label: "Hay que corregirlo", variant: "destructive" },
}

/** Pestaña "Documentación y mensajes": qué falta, mensajes de Unicréditos, respuesta y carga del documento pedido. */
export function DocumentosTab() {
  const [data, setData] = useState<{ checklist: Item[]; messages: Msg[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const pickFor = useRef<string>("")

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/merchant/messages", { cache: "no-store" })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo cargar.")
      setData({ checklist: j.checklist, messages: j.messages })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.")
    }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void load() }, [load])

  async function upload(f: File) {
    const type = pickFor.current
    setBusy(type); setNotice(null)
    const fd = new FormData()
    fd.set("type", type); fd.set("file", f)
    const r = await fetch("/api/merchant/documents", { method: "POST", body: fd })
    const j = await r.json().catch(() => ({ ok: false, error: "No se pudo subir." }))
    setBusy(null)
    if (file.current) file.current.value = ""
    if (j.ok) { setNotice("Documento enviado. Lo vamos a revisar."); await load() } else setError(j.error || "No se pudo subir.")
  }

  async function send() {
    setBusy("msg"); setNotice(null)
    const r = await fetch("/api/merchant/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) })
    const j = await r.json().catch(() => ({ ok: false, error: "No se pudo enviar." }))
    setBusy(null)
    if (j.ok) { setText(""); setNotice("Mensaje enviado."); setError(null); await load() } else setError(j.error || "No se pudo enviar.")
  }

  if (!data && !error) return <p className="text-sm text-muted-foreground" role="status">Cargando…</p>
  const pending = data?.checklist.filter((c) => c.state === "missing" || c.state === "observed") ?? []
  return (
    <div className="grid gap-5">
      <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir archivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border p-3 text-sm">{notice}</p> : null}
      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Documentación requerida</CardTitle>
              <CardDescription>{data.checklist.length === 0 ? "Tu tipo de comercio no requiere expediente societario." : pending.length ? `Te falta completar ${pending.length} documento(s).` : "Está todo cargado."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.checklist.map((c) => (
                <div key={c.type} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.fileName ?? "Todavía no lo subiste"}{c.note ? ` · ${c.note}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATE[c.state].variant}>{STATE[c.state].label}</Badge>
                    {c.state !== "approved" ? (
                      <Button size="sm" disabled={busy !== null} onClick={() => { pickFor.current = c.type; file.current?.click() }}>
                        {busy === c.type ? "Subiendo…" : c.state === "missing" ? "Subir" : "Reemplazar"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP de hasta 4 MB.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mensajes con Unicréditos</CardTitle><CardDescription>Acá te pedimos documentación y podés responder.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {data.messages.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay mensajes.</p> : (
                <ul className="grid gap-3" aria-label="Historial de mensajes">
                  {data.messages.map((m) => (
                    <li key={m.id} className={`rounded-md border p-3 text-sm ${m.from === "admin" ? "bg-muted/40" : ""}`}>
                      <div className="mb-1 flex flex-wrap items-center gap-2"><b>{m.author}</b>{m.requestedDocType && m.from === "admin" ? <Badge variant="outline">Pedido de documento</Badge> : null}{m.hasDocument && m.from === "merchant" ? <Badge variant="outline">Con documento</Badge> : null}</div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString("es-AR")}</div>
                    </li>
                  ))}
                </ul>
              )}
              <label className="grid gap-1 text-sm"><span>Tu respuesta</span>
                <textarea className="min-h-20 rounded-md border bg-background p-2" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
              </label>
              <div><Button disabled={busy !== null || text.trim().length < 3} onClick={() => void send()}>{busy === "msg" ? "Enviando…" : "Enviar respuesta"}</Button></div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
