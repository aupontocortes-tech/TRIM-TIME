/** Substitui placeholders {{chave}} no texto de lembretes e confirmações. */
export type NotificationTemplateVars = {
  nome_cliente: string
  data: string
  horario: string
  servico: string
  barbearia: string
  /** Nome da unidade do agendamento (ou da rede, se não houver unidade). */
  unidade: string
  /** Endereço formatado da unidade ou da barbearia. */
  endereco: string
  /** Linha "Como chegar: …" com link do Maps, ou vazio. */
  maps: string
  /** Nome do profissional do agendamento. */
  barbeiro: string
}

export const NOTIFICATION_TEMPLATE_VARIABLE_HELP = [
  { tag: "{{nome_cliente}}", desc: "Nome do cliente", aliases: ["{{nome}}"] },
  { tag: "{{data}}", desc: "Data do horário" },
  { tag: "{{horario}}", desc: "Hora do horário", aliases: ["{{hora}}"] },
  { tag: "{{servico}}", desc: "Nome do serviço" },
  { tag: "{{barbearia}}", desc: "Nome da rede / barbearia" },
  { tag: "{{unidade}}", desc: "Nome da unidade do agendamento" },
  { tag: "{{endereco}}", desc: "Endereço da unidade" },
  { tag: "{{maps}}", desc: "Link do Google Maps (se cadastrado)" },
  { tag: "{{barbeiro}}", desc: "Nome do profissional" },
] as const

/** Normaliza sinônimos usados nos modelos ({{nome}}, {{hora}}). */
export function normalizeNotificationTemplatePlaceholders(template: string): string {
  return template.replace(/\{\{nome\}\}/g, "{{nome_cliente}}").replace(/\{\{hora\}\}/g, "{{horario}}")
}

export function renderNotificationTemplate(
  template: string,
  vars: NotificationTemplateVars
): string {
  let out = normalizeNotificationTemplatePlaceholders(template)
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value)
  }
  return out
}
