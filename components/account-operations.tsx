'use client'

import { FileText, Receipt, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AccountOperations() {
  return <div className="grid gap-4 lg:grid-cols-3">
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4 text-primary" />Medios de pago</CardTitle></CardHeader><CardContent><Badge variant="outline">No habilitado</Badge><p className="mt-3 text-sm leading-6 text-muted-foreground">Transferencia, Mercado Pago, tarjetas, QR, Pago Fácil y Rapipago se mostrarán solo cuando exista una integración contratada y verificada.</p></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4 text-primary" />Contratos</CardTitle></CardHeader><CardContent><Badge variant="outline">Pendiente de habilitación</Badge><p className="mt-3 text-sm leading-6 text-muted-foreground">El contrato definitivo, sus tasas, CFT, impuestos, comisiones y fechas se entregarán antes de aceptar una operación.</p></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-4 text-primary" />Recibos y comprobantes</CardTitle></CardHeader><CardContent><Badge variant="outline">Sin documentos</Badge><p className="mt-3 text-sm leading-6 text-muted-foreground">No hay recibos, comprobantes de desembolso ni pagos confirmados hasta que un proveedor real emita la constancia.</p></CardContent></Card>
  </div>
}
