/** E-mail e senha salvos no aparelho (opt-in) — login do cliente no agendamento. */

export type SavedClientLoginV1 = {
  v: 1
  email: string
  senha: string
}

const STORAGE_KEY = "trimtime_client_login_remember_v1"

export function loadSavedClientLogin(): SavedClientLoginV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as SavedClientLoginV1
    if (p?.v !== 1) return null
    const email = typeof p.email === "string" ? p.email.trim() : ""
    const senha = typeof p.senha === "string" ? p.senha : ""
    if (!email) return null
    return { v: 1, email, senha }
  } catch {
    return null
  }
}

export function saveSavedClientLogin(email: string, senha: string) {
  if (typeof window === "undefined") return
  try {
    const payload: SavedClientLoginV1 = {
      v: 1,
      email: email.trim().toLowerCase(),
      senha,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function clearSavedClientLogin() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
