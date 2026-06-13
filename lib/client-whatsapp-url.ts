import { whatsappDigitsForWaMe } from "@/lib/platform-settings"

export function buildClientWhatsAppUrl(phone: string, text: string): string | null {
  const digits = whatsappDigitsForWaMe(phone)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function appointmentContactWhatsAppMessage(params: {
  clientName: string
  shopName: string
  dateYmd: string
  time: string
  service: string
}): string {
  const dateLabel = params.dateYmd
    ? new Date(`${params.dateYmd}T12:00:00`).toLocaleDateString("pt-BR")
    : "—"
  const hora = params.time.slice(0, 5)
  return `Olá ${params.clientName}, aqui é da ${params.shopName}. Estou entrando em contato sobre seu agendamento de ${dateLabel} às ${hora} (${params.service}).`
}
