"use client"

import { NOTIFICATION_TEMPLATE_VARIABLE_HELP } from "@/lib/notification-template"
import { cn } from "@/lib/utils"

type WhatsAppTemplateVarsPanelProps = {
  className?: string
  /** Tags extras além das padrão de agendamento (ex.: inativos). */
  extraTags?: readonly { tag: string; desc: string }[]
  showMultiUnitHint?: boolean
}

export function WhatsAppTemplateVarsPanel({
  className,
  extraTags = [],
  showMultiUnitHint = false,
}: WhatsAppTemplateVarsPanelProps) {
  const base = NOTIFICATION_TEMPLATE_VARIABLE_HELP.filter((v) =>
    ["{{nome_cliente}}", "{{data}}", "{{horario}}", "{{servico}}", "{{barbearia}}", "{{barbeiro}}", "{{unidade}}", "{{endereco}}", "{{maps}}", "{{link_agendamento}}", "{{dias_sem_visita}}"].includes(
      v.tag
    )
  )
  const extras = extraTags.filter((e) => !base.some((b) => b.tag === e.tag))

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-3 space-y-2", className)}>
      <p className="text-xs font-medium text-foreground">
        Palavras automáticas — copie e cole no texto
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Elas viram o dado real na hora do envio (nome do cliente, data, link, etc.). Não apague as chaves{" "}
        <code className="text-foreground/90">{"{{ }}"}</code>.
      </p>
      <ul className="space-y-1.5 pt-1">
        {[...base, ...extras].map((v) => (
          <li key={v.tag} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
            <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary shrink-0">
              {v.tag}
            </code>
            <span className="text-muted-foreground">{v.desc}</span>
          </li>
        ))}
      </ul>
      {showMultiUnitHint ? (
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
          Com várias unidades, use também <code className="text-foreground/90">{"{{unidade}}"}</code>,{" "}
          <code className="text-foreground/90">{"{{endereco}}"}</code> e{" "}
          <code className="text-foreground/90">{"{{maps}}"}</code>.
        </p>
      ) : null}
    </div>
  )
}
