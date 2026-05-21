/** Dados do cadastro guardados antes do redirect OAuth (por slug da barbearia). */
export function clientOAuthRegisterStorageKey(slug: string) {
  return `trimtime_client_reg_${slug}`
}

export type ClientOAuthRegisterDraft = { nome: string; telefone: string }

export function saveClientOAuthRegisterDraft(slug: string, draft: ClientOAuthRegisterDraft) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(clientOAuthRegisterStorageKey(slug), JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function loadClientOAuthRegisterDraft(slug: string): ClientOAuthRegisterDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(clientOAuthRegisterStorageKey(slug))
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<ClientOAuthRegisterDraft>
    if (typeof p.nome !== "string" || typeof p.telefone !== "string") return null
    return { nome: p.nome, telefone: p.telefone }
  } catch {
    return null
  }
}

export function clearClientOAuthRegisterDraft(slug: string) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(clientOAuthRegisterStorageKey(slug))
  } catch {
    /* ignore */
  }
}
