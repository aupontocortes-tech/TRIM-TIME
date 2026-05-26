/**
 * Dados do formulário de agendamento salvos no aparelho (por slug da barbearia).
 * Não inclui senha — nunca armazenar senha em localStorage.
 */

export type SavedClientProfileV1 = {
  v: 1
  nome: string
  telefone: string
  email: string
  /** Somente dígitos (11) ou string vazia */
  cpf: string
  foto?: string
  fotoPosicao?: number
}

function key(slug: string) {
  return `trimtime_booking_saved_profile_${slug}`
}

export function saveSavedClientProfile(slug: string, data: Omit<SavedClientProfileV1, "v">) {
  if (typeof window === "undefined") return
  try {
    const payload: SavedClientProfileV1 = {
      v: 1,
      nome: data.nome ?? "",
      telefone: data.telefone ?? "",
      email: data.email ?? "",
      cpf: data.cpf ?? "",
      foto: data.foto,
      fotoPosicao: data.fotoPosicao,
    }
    localStorage.setItem(key(slug), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function loadSavedClientProfile(slug: string): SavedClientProfileV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key(slug))
    if (!raw) return null
    const p = JSON.parse(raw) as SavedClientProfileV1
    if (p?.v !== 1) return null
    return {
      v: 1,
      nome: typeof p.nome === "string" ? p.nome : "",
      telefone: typeof p.telefone === "string" ? p.telefone : "",
      email: typeof p.email === "string" ? p.email : "",
      cpf: typeof p.cpf === "string" ? p.cpf.replace(/\D/g, "").slice(0, 11) : "",
      foto: typeof p.foto === "string" ? p.foto : undefined,
      fotoPosicao: typeof p.fotoPosicao === "number" ? p.fotoPosicao : undefined,
    }
  } catch {
    return null
  }
}

export function clearSavedClientProfile(slug: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(key(slug))
  } catch {
    /* ignore */
  }
}
