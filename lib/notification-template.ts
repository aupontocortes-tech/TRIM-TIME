/** Substitui placeholders {{chave}} no texto de lembretes. */
export type NotificationTemplateVars = {
  nome_cliente: string
  data: string
  horario: string
  servico: string
  barbearia: string
}

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
