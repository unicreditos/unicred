"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogCtx() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog components must be used inside <Dialog>")
  return ctx
}

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolled, setUncontrolled] = React.useState<boolean>(!!defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp! : uncontrolled

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  return (
    <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
  )
}

function DialogTrigger({ asChild, children, ...rest }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen, open } = useDialogCtx()
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...((children as any).props || {}),
      ...rest,
      type: (children as any).props?.type ?? "button",
      onClick: (e: React.MouseEvent) => {
        ;(children as any).props?.onClick?.(e)
        ;(rest as any).onClick?.(e)
        setOpen(!open)
      },
    })
  }
  return (
    <button
      type="button"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      onClick={(e) => {
        ;(rest as React.ButtonHTMLAttributes<HTMLButtonElement>).onClick?.(e)
        setOpen(!open)
      }}
    >
      {children}
    </button>
  )
}

const emptySubscribe = () => () => {}

function DialogPortal({ children }: { children: React.ReactNode }) {
  // El portal necesita document, que no existe en el servidor. useSyncExternalStore
  // devuelve false durante el render del servidor y true en el cliente, sin el
  // render extra que provoca marcar el montaje desde un efecto.
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  if (!mounted || typeof document === "undefined") return null
  return createPortal(children, document.body)
}

function DialogContent({
  className,
  children,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<"div"> & { onPointerDownOutside?: (e: any) => void }) {
  const { open, setOpen } = useDialogCtx()
  const overlayRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <DialogPortal>
      <div
        ref={overlayRef}
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
        data-state="open"
        onMouseDown={(e) => {
          if (e.target === overlayRef.current) {
            onPointerDownOutside?.(e)
            setOpen(false)
          }
        }}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            data-slot="dialog-content"
            data-state="open"
            className={cn(
              "relative z-50 w-full max-w-lg origin-center overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col",
              className
            )}
            {...(props as React.HTMLAttributes<HTMLDivElement>)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </div>
        </div>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 px-6 pt-6 pb-2 text-left sm:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 px-6 pt-2 pb-6 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
