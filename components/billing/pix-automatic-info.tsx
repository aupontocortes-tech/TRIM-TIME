"use client"

import { CheckCircle2, Info } from "lucide-react"

type Variant = "compact" | "full" | "steps"

type Props = {
  variant?: Variant
  monthlyAmount?: number
}

export function PixAutomaticInfo({ variant = "full", monthlyAmount }: Props) {
  if (variant === "compact") {
    return (
      <p className="text-xs text-muted-foreground rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
        <strong className="text-foreground">Pix Automático:</strong> no app do banco você paga e autoriza o
        débito mensal. Depois disso, a mensalidade sai da sua conta sozinha (precisa ter saldo). O Asaas pode
        avisar por e-mail antes de cada débito — você não precisa pagar QR Code todo mês.
      </p>
    )
  }

  if (variant === "steps") {
    return (
      <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
        <li>Escaneie o QR Code ou copie o código no app do seu banco.</li>
        <li>Confirme o pagamento e <strong className="text-foreground">autorize o débito recorrente</strong> mensal.</li>
        <li>Seu plano Trim Time ativa após a confirmação do 1º pagamento.</li>
        <li>
          Nos meses seguintes o valor{" "}
          {monthlyAmount != null ? (
            <strong className="text-foreground">
              ({new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(monthlyAmount)})
            </strong>
          ) : null}{" "}
          é debitado automaticamente na data de vencimento (com saldo na conta).
        </li>
      </ol>
    )
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 text-sm">
      <p className="font-medium text-foreground flex items-center gap-2">
        <Info className="w-4 h-4 text-primary shrink-0" />
        Como funciona o Pix Automático
      </p>
      <ul className="space-y-2 text-muted-foreground">
        <li className="flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            Você autoriza <strong className="text-foreground">uma vez</strong> no banco — não precisa pagar QR
            Code todo mês.
          </span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            A mensalidade é debitada automaticamente na data de vencimento (é preciso ter saldo na conta).
          </span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            O Asaas pode enviar aviso por e-mail antes do débito. Você não precisa que a Trim Time te mande
            mensagem manualmente.
          </span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            Para cancelar, use <strong className="text-foreground">Minha assinatura</strong> no painel — a
            recorrência é encerrada e não há novas cobranças.
          </span>
        </li>
      </ul>
    </div>
  )
}

export function CardBillingInfo() {
  return (
    <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
      <strong className="text-foreground">Cartão:</strong> a mensalidade é cobrada automaticamente todo mês no
      cartão cadastrado. Mantenha o cartão válido para evitar interrupção do plano.
    </p>
  )
}
