import type { BarbershopSettings } from "@/lib/db/types"
import { DIAS_SEMANA_KEYS, openingHoursFromSettings } from "@/lib/barbershop-settings-ui"

const DAY_LABELS: Record<(typeof DIAS_SEMANA_KEYS)[number], string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
}

export function formatServicePriceBrl(price: number): string {
  return `R$ ${price.toFixed(2).replace(".", ",")}`
}

export function formatOpeningHoursText(settings: BarbershopSettings | null | undefined): string {
  const horarios = openingHoursFromSettings(settings?.opening_hours)
  const lines: string[] = []

  for (const key of DIAS_SEMANA_KEYS) {
    const h = horarios[key]
    if (!h.ativo) {
      lines.push(`${DAY_LABELS[key]}: fechado`)
      continue
    }
    lines.push(`${DAY_LABELS[key]}: ${h.abertura} às ${h.fechamento}`)
  }

  return lines.join("\n")
}

export function formatServicesListText(
  services: { name: string; price: number; duration: number }[]
): string {
  if (services.length === 0) return "Nenhum serviço cadastrado no momento."

  return services
    .map((s, i) => {
      const price = formatServicePriceBrl(s.price)
      const dur = s.duration > 0 ? ` (${s.duration} min)` : ""
      return `${i + 1}. ${s.name} — ${price}${dur}`
    })
    .join("\n")
}
