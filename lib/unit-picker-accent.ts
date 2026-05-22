/** Cores estáveis por índice da unidade (agendamento público). */
export const UNIT_PICKER_ACCENTS = [
  {
    circle: "bg-amber-400",
    border: "border-amber-400/70",
    ring: "ring-amber-400/40",
    badge: "text-amber-400",
    check: "bg-amber-400 text-amber-950",
  },
  {
    circle: "bg-blue-500",
    border: "border-blue-500/70",
    ring: "ring-blue-500/40",
    badge: "text-blue-400",
    check: "bg-blue-500 text-white",
  },
  {
    circle: "bg-emerald-500",
    border: "border-emerald-500/70",
    ring: "ring-emerald-500/40",
    badge: "text-emerald-400",
    check: "bg-emerald-500 text-white",
  },
  {
    circle: "bg-violet-500",
    border: "border-violet-500/70",
    ring: "ring-violet-500/40",
    badge: "text-violet-400",
    check: "bg-violet-500 text-white",
  },
  {
    circle: "bg-orange-500",
    border: "border-orange-500/70",
    ring: "ring-orange-500/40",
    badge: "text-orange-400",
    check: "bg-orange-500 text-white",
  },
] as const

export function unitPickerAccent(index: number) {
  return UNIT_PICKER_ACCENTS[index % UNIT_PICKER_ACCENTS.length]
}

export type UnitPickerAddressFields = {
  address: string | null
  city: string | null
  state: string | null
  cep: string | null
}

export function formatUnitAddressLine(u: UnitPickerAddressFields): string {
  const line1 = u.address?.trim() ?? ""
  const cityState = [u.city, u.state].filter(Boolean).join(" - ")
  const cep = u.cep?.trim() ? `CEP ${u.cep.trim()}` : ""
  const parts = [line1, cityState, cep].filter((p) => p.length > 0)
  return parts.length > 0 ? parts.join(" · ") : "Endereço não informado"
}
