/**
 * Auth do cliente na página de agendamento (link da barbearia).
 * Persiste no localStorage por barbearia (slug).
 * Em produção, trocar por API + sessão.
 */

export type ClienteAgendamento = {
  id: string
  nome: string
  email: string
  telefone: string
  /** Hash simples para checagem de login (em produção usar backend) */
  senhaHash: string
  barbeariaSlug: string
  criadoEm: string
}

const STORAGE_KEY = "trimtime_cliente"
const LIST_KEY = "trimtime_clientes_list"

function keyCliente(slug: string) {
  return `${STORAGE_KEY}_${slug}`
}

function keyList(slug: string) {
  return `${LIST_KEY}_${slug}`
}

/** Hash simples para demo (em produção usar backend) */
function hashSenha(senha: string): string {
  if (typeof window === "undefined") return ""
  let h = 0
  for (let i = 0; i < senha.length; i++) {
    const c = senha.charCodeAt(i)
    h = (h << 5) - h + c
    h |= 0
  }
  return String(h)
}

/** Retorna o cliente logado para esta barbearia (apenas no cliente) */
export function getClienteLogado(slug: string): ClienteAgendamento | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(keyCliente(slug))
    if (!raw) return null
    return JSON.parse(raw) as ClienteAgendamento
  } catch {
    return null
  }
}

/** Salva cliente no sistema e deixa logado */
export function cadastrarCliente(
  slug: string,
  dados: { nome: string; email: string; telefone: string; senha: string }
): ClienteAgendamento {
  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const cliente: ClienteAgendamento = {
    id,
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    telefone: dados.telefone.trim(),
    senhaHash: hashSenha(dados.senha),
    barbeariaSlug: slug,
    criadoEm: new Date().toISOString(),
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(keyCliente(slug), JSON.stringify(cliente))
    const listKey = keyList(slug)
    const listRaw = localStorage.getItem(listKey)
    const list: ClienteAgendamento[] = listRaw ? JSON.parse(listRaw) : []
    if (!list.find((c) => c.email === cliente.email || c.telefone === cliente.telefone)) {
      list.push(cliente)
      localStorage.setItem(listKey, JSON.stringify(list))
    }
  }
  return cliente
}

/** Login por email ou telefone + senha */
export function loginCliente(
  slug: string,
  emailOuTelefone: string,
  senha: string
): ClienteAgendamento | null {
  if (typeof window === "undefined") return null
  const listRaw = localStorage.getItem(keyList(slug))
  if (!listRaw) return null
  const list: ClienteAgendamento[] = JSON.parse(listRaw)
  const senhaHash = hashSenha(senha)
  const cliente = list.find(
    (c) =>
      (c.email === emailOuTelefone.toLowerCase().trim() ||
        c.telefone.replace(/\D/g, "") === emailOuTelefone.replace(/\D/g, "")) &&
      c.senhaHash === senhaHash
  )
  if (!cliente) return null
  localStorage.setItem(keyCliente(slug), JSON.stringify(cliente))
  return cliente
}

/** Desloga o cliente desta barbearia */
export function logoutCliente(slug: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(keyCliente(slug))
}
