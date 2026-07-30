import type { NotificationTemplateVars } from "@/lib/notification-template"
import { buildWaitlistConfirmUrl } from "@/lib/waitlist-confirm-token"

function formatDatePtFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

/** Variáveis para aviso de vaga na lista de espera (WhatsApp, e-mail, push). */
export function buildWaitlistSlotNotificationVars(args: {
  clientName: string
  barbershopName: string
  slug: string
  itemId: string
  barberName: string
  serviceName: string
  dateYmd: string
  time: string
  deadlineMinutes: number
}): NotificationTemplateVars & { link_confirmar: string; prazo_minutos: string } {
  const horario = args.time.slice(0, 5)
  return {
    nome_cliente: args.clientName,
    servico: args.serviceName,
    barbearia: args.barbershopName,
    data: formatDatePtFromYmd(args.dateYmd),
    horario,
    unidade: args.barbershopName,
    endereco: "",
    maps: "",
    barbeiro: args.barberName,
    link_confirmar: buildWaitlistConfirmUrl(args.slug, args.itemId),
    prazo_minutos: String(args.deadlineMinutes),
  }
}
