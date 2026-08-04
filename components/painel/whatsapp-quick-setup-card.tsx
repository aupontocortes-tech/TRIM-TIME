"use client"

import { CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { FieldLabel } from "@/components/ui/field"

type WhatsAppQuickSetupCardProps = {
  remindersEnabled: boolean
  onRemindersChange: (enabled: boolean) => void
  autoRepliesEnabled: boolean
  onAutoRepliesChange: (enabled: boolean) => void
  inactiveEnabled: boolean
  onInactiveChange: (enabled: boolean) => void
  showInactive?: boolean
}

const TOGGLE_ROWS = [
  {
    id: "reminders",
    title: "Lembrete antes do horário",
    desc: "Avisa o cliente no WhatsApp antes do corte.",
  },
  {
    id: "auto",
    title: "Responder o cliente sozinho",
    desc: "Quando mandam mensagem (ex.: endereço, horário), responde automaticamente.",
  },
  {
    id: "inactive",
    title: "Trazer quem parou de vir",
    desc: "Manda WhatsApp para clientes sumidos (2 tentativas, depois para).",
  },
] as const

export function WhatsAppQuickSetupCard({
  remindersEnabled,
  onRemindersChange,
  autoRepliesEnabled,
  onAutoRepliesChange,
  inactiveEnabled,
  onInactiveChange,
  showInactive = true,
}: WhatsAppQuickSetupCardProps) {
  const rows = TOGGLE_ROWS.filter((r) => r.id !== "inactive" || showInactive)

  const values: Record<string, boolean> = {
    reminders: remindersEnabled,
    auto: autoRepliesEnabled,
    inactive: inactiveEnabled,
  }

  const setters: Record<string, (v: boolean) => void> = {
    reminders: onRemindersChange,
    auto: onAutoRepliesChange,
    inactive: onInactiveChange,
  }

  return (
    <Card className="bg-card border-primary/30 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-lg">Configuração rápida</CardTitle>
        <CardDescription className="text-muted-foreground">
          É só ligar o que você quer. As mensagens padrão já funcionam —{" "}
          <strong className="text-foreground font-medium">não precisa escrever nada</strong> se não quiser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3"
          >
            <div className="min-w-0 space-y-0.5">
              <FieldLabel htmlFor={`wa-quick-${row.id}`} className="cursor-pointer text-sm font-medium">
                {row.title}
              </FieldLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">{row.desc}</p>
            </div>
            <Switch
              id={`wa-quick-${row.id}`}
              checked={values[row.id]}
              onCheckedChange={setters[row.id]}
              className="shrink-0 mt-0.5"
            />
          </div>
        ))}

        <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/25 px-3 py-2.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Pronto para usar. Clique em <strong className="font-medium">Salvar</strong> no final da página. Só abra
            &quot;Personalizar&quot; se quiser mudar textos ou horários.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
