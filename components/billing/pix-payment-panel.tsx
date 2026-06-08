"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, QrCode } from "lucide-react"

type Props = {
  amount: number
  pixCopyPaste: string | null
  pixQrCode: string | null
  onClose?: () => void
}

export function PixPaymentPanel({ amount, pixCopyPaste, pixQrCode, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copyPix = async () => {
    if (!pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* fallback abaixo */
    }
  }

  const qrSrc = pixQrCode
    ? pixQrCode.startsWith("data:")
      ? pixQrCode
      : `data:image/png;base64,${pixQrCode}`
    : null

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <QrCode className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-foreground">Pague com PIX</p>
          <p className="text-sm text-muted-foreground">
            Valor:{" "}
            <strong className="text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
            </strong>
            . Escaneie o QR ou copie o código — o pagamento é confirmado automaticamente.
          </p>
        </div>
      </div>

      {qrSrc ? (
        <div className="flex justify-center">
          <img
            src={qrSrc}
            alt="QR Code PIX"
            className="w-48 h-48 rounded-lg border border-border bg-white p-2"
          />
        </div>
      ) : null}

      {pixCopyPaste ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Código copia e cola</p>
          <div className="rounded-lg border border-border bg-background p-3 text-xs font-mono break-all text-foreground max-h-24 overflow-y-auto">
            {pixCopyPaste}
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={() => void copyPix()}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-emerald-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar código PIX
              </>
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aguarde alguns segundos e recarregue a página se o código PIX não aparecer.
        </p>
      )}

      {onClose ? (
        <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
          Fechar
        </Button>
      ) : null}
    </div>
  )
}
