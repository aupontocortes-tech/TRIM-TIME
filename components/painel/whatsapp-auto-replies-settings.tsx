"use client"

import { Plus, RotateCcw, Trash2 } from "lucide-react"
import type { WhatsAppAutoReplyRule } from "@/lib/db/types"
import { DEFAULT_WHATSAPP_AUTO_REPLY_RULES } from "@/lib/whatsapp-auto-reply-defaults"
import { NOTIFICATION_TEMPLATE_VARIABLE_HELP } from "@/lib/notification-template"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"

const AUTO_REPLY_EXTRA_VARS = [
  { tag: "{{proximo_agendamento}}", desc: "Próximo horário do cliente (pelo telefone)" },
  { tag: "{{lista_unidades}}", desc: "Lista de unidades / endereços" },
  { tag: "{{link_agendamento}}", desc: "Link público para agendar" },
] as const

type WhatsAppAutoRepliesSettingsProps = {
  enabled: boolean
  rules: WhatsAppAutoReplyRule[]
  webhookUrl: string
  onEnabledChange: (enabled: boolean) => void
  onRulesChange: (rules: WhatsAppAutoReplyRule[]) => void
}

function newRuleId() {
  return `custom-${Date.now().toString(36)}`
}

export function WhatsAppAutoRepliesSettings({
  enabled,
  rules,
  webhookUrl,
  onEnabledChange,
  onRulesChange,
}: WhatsAppAutoRepliesSettingsProps) {
  const updateRule = (index: number, patch: Partial<WhatsAppAutoReplyRule>) => {
    onRulesChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removeRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index))
  }

  const addRule = () => {
    onRulesChange([
      ...rules,
      {
        id: newRuleId(),
        enabled: true,
        keywords: ["palavra-chave"],
        reply_template: "Olá {{nome_cliente}}!",
      },
    ])
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Respostas automáticas (palavras-chave)</CardTitle>
        <CardDescription className="text-muted-foreground">
          Quando o cliente mandar mensagem no WhatsApp da barbearia, o Trim Time responde se a frase contiver uma
          palavra-chave configurada abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
          <Checkbox checked={enabled} onCheckedChange={(v) => onEnabledChange(v === true)} />
          Ativar respostas automáticas por palavra-chave
        </label>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">Webhook no console Green API</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Em{" "}
            <a
              href="https://console.green-api.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.green-api.com
            </a>
            , abra sua instância → Configurações → cole esta URL de webhook:
          </p>
          <code className="block break-all rounded bg-background/80 px-2 py-1.5 text-[11px] text-foreground">
            {webhookUrl}
          </code>
        </div>

        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={rule.id ?? index} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox
                    checked={rule.enabled !== false}
                    onCheckedChange={(v) => updateRule(index, { enabled: v === true })}
                  />
                  Regra {index + 1}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRule(index)}
                  aria-label="Remover regra"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Field>
                <FieldLabel>Palavras-chave (separe por vírgula)</FieldLabel>
                <Input
                  className="mt-1 bg-input border-border text-foreground"
                  value={rule.keywords.join(", ")}
                  onChange={(e) =>
                    updateRule(index, {
                      keywords: e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="endereço, onde fica, localização"
                />
              </Field>
              <Field>
                <FieldLabel>Resposta automática</FieldLabel>
                <Textarea
                  className="mt-1 min-h-[72px] bg-input border-border text-foreground"
                  value={rule.reply_template}
                  onChange={(e) => updateRule(index, { reply_template: e.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="border-border" onClick={addRule}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar regra
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onRulesChange(DEFAULT_WHATSAPP_AUTO_REPLY_RULES.map((r) => ({ ...r })))}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Restaurar padrão
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-foreground">Palavras automáticas na resposta:</p>
          <div className="flex flex-wrap gap-1.5">
            {[...NOTIFICATION_TEMPLATE_VARIABLE_HELP, ...AUTO_REPLY_EXTRA_VARS].map((v) => (
              <span
                key={v.tag}
                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                title={v.desc}
              >
                {v.tag}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
