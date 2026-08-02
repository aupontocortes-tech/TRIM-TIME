"use client"

import { Plus, RotateCcw, Trash2 } from "lucide-react"
import type { WhatsAppAutoReplyRule } from "@/lib/db/types"
import {
  DEFAULT_WHATSAPP_AUTO_REPLY_RULES,
  WHATSAPP_AUTO_REPLY_RULE_LABELS,
} from "@/lib/whatsapp-auto-reply-defaults"
import { NOTIFICATION_TEMPLATE_VARIABLE_HELP } from "@/lib/notification-template"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"

const AUTO_REPLY_EXTRA_VARS = [
  { tag: "{{proximo_agendamento}}", desc: "Próximo horário do cliente (pelo telefone)", group: "Agendamento" },
  { tag: "{{profissional_agendamento}}", desc: "Profissional do próximo horário", group: "Agendamento" },
  { tag: "{{confirmar_resposta}}", desc: "Confirma vaga ou horário pendente (ação automática)", group: "Agendamento" },
  { tag: "{{cancelar_remarcar}}", desc: "Instruções para cancelar/remarcar + link", group: "Agendamento" },
  { tag: "{{lista_espera}}", desc: "Status da fila + link para confirmar vaga", group: "Lista de espera" },
  { tag: "{{lista_servicos}}", desc: "Serviços ativos com preços", group: "Informações" },
  { tag: "{{horario_funcionamento}}", desc: "Dias e horários de abertura", group: "Informações" },
  { tag: "{{lista_profissionais}}", desc: "Profissionais ativos + link", group: "Informações" },
  { tag: "{{lista_unidades}}", desc: "Unidades e endereços", group: "Informações" },
  { tag: "{{link_agendamento}}", desc: "Link público /b/slug", group: "Informações" },
] as const

const VAR_GROUPS = ["Agendamento", "Lista de espera", "Informações"] as const

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

function ruleLabel(rule: WhatsAppAutoReplyRule, index: number): string {
  if (rule.id && WHATSAPP_AUTO_REPLY_RULE_LABELS[rule.id]) {
    return WHATSAPP_AUTO_REPLY_RULE_LABELS[rule.id]
  }
  return `Personalizada ${index + 1}`
}

function sortRulesByDefaultOrder(rules: WhatsAppAutoReplyRule[]): WhatsAppAutoReplyRule[] {
  const order = DEFAULT_WHATSAPP_AUTO_REPLY_RULES.map((r) => r.id)
  return [...rules].sort((a, b) => {
    const ia = a.id ? order.indexOf(a.id) : 999
    const ib = b.id ? order.indexOf(b.id) : 999
    if (ia !== ib) return ia - ib
    return 0
  })
}

export function WhatsAppAutoRepliesSettings({
  enabled,
  rules,
  webhookUrl,
  onEnabledChange,
  onRulesChange,
}: WhatsAppAutoRepliesSettingsProps) {
  const sortedRules = sortRulesByDefaultOrder(rules)

  const updateRule = (rule: WhatsAppAutoReplyRule, patch: Partial<WhatsAppAutoReplyRule>) => {
    onRulesChange(
      rules.map((r) => {
        if (rule.id && r.id === rule.id) return { ...r, ...patch }
        if (!rule.id && r === rule) return { ...r, ...patch }
        return r
      })
    )
  }

  const removeRule = (rule: WhatsAppAutoReplyRule) => {
    onRulesChange(
      rules.filter((r) => {
        if (rule.id && r.id === rule.id) return false
        if (!rule.id && r === rule) return false
        return true
      })
    )
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
          Palavra-chave → resposta automática. Se o cliente mandar algo fora das regras, recebe um menu curto
          (número + palavra). Digitando <strong className="text-foreground">3</strong> ou{" "}
          <strong className="text-foreground">confirmo</strong>, a resposta certa é enviada na hora.
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
            , abra sua instância → Configurações → cole esta URL:
          </p>
          <code className="block break-all rounded bg-background/80 px-2 py-1.5 text-[11px] text-foreground">
            {webhookUrl}
          </code>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Regras configuradas</p>
          {sortedRules.map((rule, index) => (
            <div key={rule.id ?? `rule-${index}`} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-w-0">
                  <Checkbox
                    checked={rule.enabled !== false}
                    onCheckedChange={(v) => updateRule(rule, { enabled: v === true })}
                  />
                  <span className="truncate">{ruleLabel(rule, index)}</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRule(rule)}
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
                    updateRule(rule, {
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
                  onChange={(e) => updateRule(rule, { reply_template: e.target.value })}
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

        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
          <p className="text-xs font-medium text-foreground">Variáveis disponíveis na resposta</p>
          <div className="flex flex-wrap gap-1.5">
            {NOTIFICATION_TEMPLATE_VARIABLE_HELP.map((v) => (
              <span
                key={v.tag}
                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                title={v.desc}
              >
                {v.tag}
              </span>
            ))}
          </div>
          {VAR_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {AUTO_REPLY_EXTRA_VARS.filter((v) => v.group === group).map((v) => (
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
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
