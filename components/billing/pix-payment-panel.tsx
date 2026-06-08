"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, QrCode } from "lucide-react"
import { PixAutomaticInfo } from "@/components/billing/pix-automatic-info"

type Props = {
  amount: number
  pixCopyPaste: string | null
  pixQrCode: string | null
  /** Pix Automático: autoriza débito mensal no banco após o 1º pagamento. */
  automatic?: boolean
  onClose?: () => void
}

export function PixPaymentPanel({
  amount,
  pixCopyPaste,
  pixQrCode,
  automatic = false,
  onClose,
}: Props) {
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
          <p className="font-semibold text-foreground">
            {automatic ? "Ative com Pix Automático" : "Pague com PIX"}
          </p>
          <p className="text-sm text-muted-foreground">
            Valor desta cobrança:{" "}
            <strong className="text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
            </strong>
            {automatic ? " (1ª mensalidade + autorização do débito mensal)" : "."}
          </p>
        </div>
      </div>

      {automatic ? (
        <PixAutomaticInfo variant="steps" monthlyAmount={amount} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Escaneie o QR ou copie o código. Após confirmar, o plano ativa automaticamente.
        </p>
      )}

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

      {automatic ? (
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Ao autorizar no banco, você concorda com o débito mensal do plano Trim Time. O Asaas pode avisar por
          e-mail antes de cada cobrança.
        </p>
      ) : null}

      {onClose ? (
        <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
          Fechar
        </Button>
      ) : null}
    </div>
  )
}
