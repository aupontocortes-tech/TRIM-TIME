/**
 * Lembra o último agendamento confirmado por barbearia (localStorage),
 * para o cliente ver resumo + Trim Play ao reabrir o link.
 */

export type PersistedClientBookingV1 = {
  v: 1
  clienteId: string
  confirmedAt: string
  unitId: string | null
  unitName: string | null
  dataIso: string
  horario: string
  profissionalId: string
  profissionalNome: string
  servicos: { id: string; nome: string; preco: number; duracao: number }[]
  nomeExibicao: string
  totalPreco: number
  totalDuracao: number
  /** Telefone só dígitos no momento da confirmação — reabrir o app com sessão pode casar por telefone se o id mudar. */
  clientPhoneDigits?: string | null
  /** true = fluxo sem conta logada na hora da confirmação (API ainda cria cliente com UUID). */
  bookedWithoutLogin?: boolean
  /**
   * confirmation = tela cheia de confirmação (padrão ao concluir agendamento ou dados antigos sem campo).
   * browsing = após "Concluir" no resumo: card de gestão sem novo wizard até remarcar.
   */
  uiFocus?: "confirmation" | "browsing"
}

function key(slug: string) {
  return `trimtime_booking_confirm_${slug}`
}

export function saveConfirmedBooking(slug: string, data: PersistedClientBookingV1) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key(slug), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function loadConfirmedBooking(slug: string): PersistedClientBookingV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key(slug))
    if (!raw) return null
    const p = JSON.parse(raw) as PersistedClientBookingV1
    if (p?.v !== 1 || !p.clienteId || !p.dataIso || !p.horario) return null
    return p
  } catch {
    return null
  }
}

export function clearConfirmedBooking(slug: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(key(slug))
  } catch {
    /* ignore */
  }
}
