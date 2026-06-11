import type { Barbershop, BarbershopUnit } from "@/lib/db/types"

export type BarbeariaContactForm = {
  nome: string
  email: string
  telefone: string
  endereco: string
  cidade: string
  estado: string
  cep: string
  linkGoogleMaps: string
}

export function isPrincipalBarbershopUnit(
  unit: BarbershopUnit,
  barbershopName: string,
  units: BarbershopUnit[]
): boolean {
  if (unit.name.trim().toLowerCase() === barbershopName.trim().toLowerCase()) return true
  const oldest = [...units].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  return oldest?.id === unit.id
}

export function resolveBarbeariaContactEditScope(
  barbershop: Pick<Barbershop, "name" | "email" | "phone" | "settings">,
  units: BarbershopUnit[],
  selectedUnitId: string | null
): { mode: "account" | "unit"; unitId: string | null; unit: BarbershopUnit | null } {
  const multi = units.length > 1
  if (multi && !selectedUnitId) {
    return { mode: "account", unitId: null, unit: null }
  }
  const unitId = multi ? selectedUnitId : units[0]?.id ?? null
  const unit = unitId ? units.find((u) => u.id === unitId) ?? null : null
  return { mode: unit ? "unit" : "account", unitId, unit }
}

/** Preenche o formulário da aba Barbearia conforme a unidade ativa no painel. */
export function barbeariaContactFormFromScope(
  barbershop: Pick<Barbershop, "name" | "email" | "phone" | "settings">,
  units: BarbershopUnit[],
  selectedUnitId: string | null
): BarbeariaContactForm {
  const { mode, unit } = resolveBarbeariaContactEditScope(barbershop, units, selectedUnitId)
  if (mode === "account" || !unit) {
    return {
      nome: barbershop.name,
      email: barbershop.email,
      telefone: barbershop.phone ?? "",
      endereco: barbershop.settings?.address ?? "",
      cidade: barbershop.settings?.city ?? "",
      estado: barbershop.settings?.state ?? "",
      cep: barbershop.settings?.cep ?? "",
      linkGoogleMaps: barbershop.settings?.maps_url ?? "",
    }
  }

  const principal = isPrincipalBarbershopUnit(unit, barbershop.name, units)
  return {
    nome: unit.name,
    email: barbershop.email,
    telefone: unit.phone ?? (principal ? barbershop.phone ?? "" : ""),
    endereco: unit.address ?? (principal ? barbershop.settings?.address ?? "" : ""),
    cidade: unit.city ?? (principal ? barbershop.settings?.city ?? "" : ""),
    estado: unit.state ?? (principal ? barbershop.settings?.state ?? "" : ""),
    cep: unit.cep ?? (principal ? barbershop.settings?.cep ?? "" : ""),
    linkGoogleMaps: unit.maps_url ?? (principal ? barbershop.settings?.maps_url ?? "" : ""),
  }
}
