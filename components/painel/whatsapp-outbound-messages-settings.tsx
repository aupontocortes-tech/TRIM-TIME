"use client"

import { CalendarCheck, Clock3, Heart, RotateCcw } from "lucide-react"
import {
  DEFAULT_WHATSAPP_CONFIRMATION,
  DEFAULT_WHATSAPP_POST_SERVICE,
  DEFAULT_WHATSAPP_REMINDER,
} from "@/lib/notification-default-templates"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { WhatsAppTemplateVarsPanel } from "@/components/painel/whatsapp-template-vars-panel"

type WhatsAppOutboundMessagesSettingsProps = {
  confirmTemplate: string
  reminderTemplate: string
  postServiceTemplate: string
  remindersEnabled: boolean
  showMultiUnitHint?: boolean
  compact?: boolean
  embedded?: boolean
  onConfirmChange: (value: string) => void
  onReminderChange: (value: string) => void
  onPostServiceChange: (value: string) => void
}

const MESSAGE_SECTIONS = [
  {
    id: "confirm",
    icon: CalendarCheck,
    iconClass: "text-green-500",
    title: "Confirmação do agendamento",
    when: "Quando o cliente marca, remarca ou você altera o horário na Agenda.",
    example: 'Ex.: Olá {{nome_cliente}}, confirmado para {{data}} às {{horario}}!',
    defaultTpl: DEFAULT_WHATSAPP_CONFIRMATION,
  },
  {
    id: "reminder",
    icon: Clock3,
    iconClass: "text-blue-500",
    title: "Lembrete antes do horário",
    when: "Antes do horário marcado (se lembretes estiverem ativos abaixo).",
    example: "Ex.: {{nome_cliente}}, lembrando do seu horário às {{horario}}.",
    defaultTpl: DEFAULT_WHATSAPP_REMINDER,
  },
  {
    id: "post",
    icon: Heart,
    iconClass: "text-rose-500",
    title: "Mensagem pós-atendimento",
    when: "Depois que o atendimento é finalizado na Agenda.",
    example: "Ex.: Obrigado pela visita, {{nome_cliente}}!",
    defaultTpl: DEFAULT_WHATSAPP_POST_SERVICE,
  },
] as const

export function WhatsAppOutboundMessagesSettings({
  confirmTemplate,
  reminderTemplate,
  postServiceTemplate,
  remindersEnabled,
  showMultiUnitHint,
  compact,
  embedded,
  onConfirmChange,
  onReminderChange,
  onPostServiceChange,
}: WhatsAppOutboundMessagesSettingsProps) {
  const values: Record<(typeof MESSAGE_SECTIONS)[number]["id"], string> = {
    confirm: confirmTemplate,
    reminder: reminderTemplate,
    post: postServiceTemplate,
  }

  const setters: Record<(typeof MESSAGE_SECTIONS)[number]["id"], (v: string) => void> = {
    confirm: onConfirmChange,
    reminder: onReminderChange,
    post: onPostServiceChange,
  }

  const body = (
    <>
      <Accordion type="multiple" defaultValue={compact || embedded ? [] : ["confirm"]} className="w-full">
          {MESSAGE_SECTIONS.map((section) => {
            const Icon = section.icon
            const disabled = section.id === "reminder" && !remindersEnabled
            return (
              <AccordionItem key={section.id} value={section.id} className="border-border px-1">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2 text-left text-sm font-medium text-foreground">
                    <Icon className={`h-4 w-4 shrink-0 ${section.iconClass}`} />
                    {section.title}
                    {disabled ? (
                      <span className="text-[10px] font-normal text-muted-foreground">(lembrete desligado)</span>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/40 border border-border/60 px-3 py-2">
                    <strong className="text-foreground font-medium">Quando envia:</strong> {section.when}
                  </p>
                  <Field>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel>Mensagem</FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        disabled={disabled}
                        onClick={() => setters[section.id](section.defaultTpl)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restaurar padrão
                      </Button>
                    </div>
                    <Textarea
                      className="mt-1.5 bg-input border-border text-foreground min-h-[100px]"
                      value={values[section.id]}
                      disabled={disabled}
                      onChange={(e) => setters[section.id](e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">{section.example}</p>
                  </Field>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <WhatsAppTemplateVarsPanel showMultiUnitHint={showMultiUnitHint} />
    </>
  )

  if (embedded) {
    return <div className="space-y-4 max-w-2xl">{body}</div>
  }

  return (
    <Card className={compact ? "border-border bg-muted/10 shadow-none" : "bg-card border-border"}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="text-foreground text-base flex items-center gap-2">
          {!compact ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              2
            </span>
          ) : null}
          Mensagens enviadas ao cliente
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {compact ? (
            <span className="block space-y-1">
              <span className="block">Três mensagens automáticas — abra só a que quiser mudar:</span>
              <span className="block text-[11px]">
                confirmação ao agendar · lembrete antes do horário · agradecimento após o corte
              </span>
            </span>
          ) : (
            "Edite só se quiser personalizar. Se não mexer, o texto padrão já funciona. Abra cada bloco abaixo para ver e alterar."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">{body}</CardContent>
    </Card>
  )
}
