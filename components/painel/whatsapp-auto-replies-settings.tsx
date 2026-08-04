"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react"
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
  sectionStep?: number
  hideEnableToggle?: boolean
  hideWebhook?: boolean
  embedded?: boolean
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
  sectionStep,
  hideEnableToggle,
  hideWebhook,
  embedded,
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
    <Card
      className={
        embedded
          ? "border-0 bg-transparent shadow-none"
          : hideEnableToggle
            ? "border-border bg-muted/10 shadow-none"
            : "border-border bg-card"
      }
    >
      {!embedded ? (
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            {sectionStep && !hideEnableToggle ? (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {sectionStep}
              </span>
            ) : null}
            Respostas automáticas
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {hideEnableToggle
              ? "Edite palavras que o cliente manda e a resposta de cada uma."
              : "Quando o cliente manda uma palavra no WhatsApp, o sistema responde sozinho (ex.: \"endereço\" → manda o endereço). Áudio recebe aviso para digitar. Menu numerado só se nenhuma palavra bater."}
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className={embedded ? "p-0 space-y-4 max-w-2xl" : "space-y-4 max-w-2xl"}>
        {!hideEnableToggle ? (
          <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <Checkbox checked={enabled} onCheckedChange={(v) => onEnabledChange(v === true)} />
            Ativar respostas automáticas
          </label>
        ) : !enabled ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2">
            Desligado — ligue &quot;Responder o cliente sozinho&quot; na configuração rápida acima para editar as
            respostas.
          </p>
        ) : null}

        {enabled ? (
          <>
            {!hideWebhook ? (
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
            ) : null}

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Regras — clique para editar</p>
              <p className="text-xs text-muted-foreground -mt-2">
                Cada linha é uma palavra (ou frase) que o cliente pode mandar e a resposta automática.
              </p>
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
                <FieldLabel>O que o cliente pode digitar</FieldLabel>
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
                  placeholder="endereço, onde fica, horário"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Separe por vírgula. Ex.: cliente manda &quot;endereço&quot; → recebe a resposta abaixo.
                </p>
              </Field>
              <Field>
                <FieldLabel>Resposta que o WhatsApp envia</FieldLabel>
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

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between h-9 px-2 text-xs text-muted-foreground hover:text-foreground group"
            >
              Ver palavras automáticas para as respostas
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 mt-1">
            <p className="text-[11px] text-muted-foreground">
              Copie e cole no texto da resposta. Na hora do envio viram o dado real do cliente.
            </p>
            <ul className="space-y-1.5">
              {NOTIFICATION_TEMPLATE_VARIABLE_HELP.filter((v) =>
                ["{{nome_cliente}}", "{{barbearia}}", "{{link_agendamento}}", "{{endereco}}"].includes(v.tag)
              ).map((v) => (
                <li key={v.tag} className="flex flex-wrap gap-x-2 text-[11px]">
                  <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">{v.tag}</code>
                  <span className="text-muted-foreground">{v.desc}</span>
                </li>
              ))}
            </ul>
            {VAR_GROUPS.map((group) => (
              <div key={group}>
                <p className="text-[11px] font-medium text-foreground mb-1.5">{group}</p>
                <ul className="space-y-1">
                  {AUTO_REPLY_EXTRA_VARS.filter((v) => v.group === group).map((v) => (
                    <li key={v.tag} className="flex flex-wrap gap-x-2 text-[11px]">
                      <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">{v.tag}</code>
                      <span className="text-muted-foreground">{v.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
