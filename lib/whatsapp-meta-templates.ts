import type { NotificationTemplateVars } from "@/lib/notification-template"

/** Template padrão da Meta na Etapa 1 (mesmo do botão “Enviar mensagem” / hello world). */
export const META_WHATSAPP_FALLBACK_TEMPLATE = {
  name: "hello_world",
  languageCode: "en_US",
} as const

export function metaTemplateBodyParamsFromVars(vars: NotificationTemplateVars): string[] {
  return [
    vars.nome_cliente ?? "",
    vars.data ?? "",
    vars.horario ?? "",
    vars.servico ?? "",
    vars.barbeiro ?? "",
  ]
}
