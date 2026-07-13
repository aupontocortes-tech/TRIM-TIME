import type { BarbershopSettings } from "@/lib/db/types"
import type { NotificationTemplateVars } from "@/lib/notification-template"
import { formatUnitAddressLine, type UnitPickerAddressFields } from "@/lib/unit-picker-accent"

type UnitRow = {
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
  mapsUrl?: string | null
} | null | undefined

type BarberRow = { name: string; unit?: UnitRow } | null | undefined

function formatDatePt(date: Date): string {
  const ymd = date.toISOString().slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function settingsAddressFields(settings: BarbershopSettings | null | undefined): UnitPickerAddressFields {
  return {
    address: settings?.address ?? null,
    city: settings?.city ?? null,
    state: settings?.state ?? null,
    cep: settings?.cep ?? null,
    maps_url: settings?.maps_url ?? null,
  }
}

function unitToAddressFields(unit: UnitRow): UnitPickerAddressFields | null {
  if (!unit) return null
  return {
    address: unit.address ?? null,
    city: unit.city ?? null,
    state: unit.state ?? null,
    cep: unit.cep ?? null,
    maps_url: unit.mapsUrl ?? null,
  }
}

function resolveUnitContext(params: {
  unit: UnitRow
  barber: BarberRow
  barbershopName: string
  settings: BarbershopSettings | null | undefined
}): { unidade: string; endereco: string; maps: string } {
  const unit = params.unit ?? params.barber?.unit ?? null
  const unidade = unit?.name?.trim() || params.barbershopName
  const addressFields = unitToAddressFields(unit) ?? settingsAddressFields(params.settings)
  const endereco = formatUnitAddressLine(addressFields)
  const mapsUrl = addressFields.maps_url?.trim() ?? ""
  const maps = mapsUrl ? `Como chegar: ${mapsUrl}` : ""
  return { unidade, endereco, maps }
}

/** Monta variáveis de template a partir do agendamento (inclui unidade, endereço e maps). */
export function buildAppointmentNotificationVars(appt: {
  client: { name: string }
  service: { name: string }
  barbershop: { name: string; settings?: unknown }
  barber: { name: string; unit?: UnitRow }
  unit?: UnitRow
  date: Date
  time: string
}): NotificationTemplateVars {
  const settings = appt.barbershop.settings as BarbershopSettings | null | undefined
  const { unidade, endereco, maps } = resolveUnitContext({
    unit: appt.unit,
    barber: appt.barber,
    barbershopName: appt.barbershop.name,
    settings,
  })
  return {
    nome_cliente: appt.client.name,
    servico: appt.service.name,
    barbearia: appt.barbershop.name,
    data: formatDatePt(appt.date),
    horario: appt.time.slice(0, 5),
    unidade,
    endereco,
    maps,
    barbeiro: appt.barber.name,
  }
}

/** Valores de exemplo para pré-visualização na UI de configurações. */
export function sampleNotificationTemplateVars(
  barbershopName = "Barbearia",
  multiUnit = false
): NotificationTemplateVars {
  return {
    nome_cliente: "João",
    servico: "Corte",
    barbearia: barbershopName,
    data: "05/07/2026",
    horario: "15:00",
    unidade: multiUnit ? `${barbershopName} — Centro` : barbershopName,
    endereco: "Rua Exemplo, 123 · São Paulo - SP",
    maps: "Como chegar: https://maps.app.goo.gl/exemplo",
    barbeiro: "Carlos",
  }
}
