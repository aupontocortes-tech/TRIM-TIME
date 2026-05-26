/**
 * Identidade no cadastro de barbearia (e-mail canônico, telefone para comparação).
 * Sem deps de servidor — pode usar no cliente.
 */

export function normalizeSignupEmail(s: string) {
  return s.trim().toLowerCase()
}

export function isValidSignupEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/**
 * Gmail / Googlemail: ignora pontos na parte local e tudo depois de +.
 * Assim não abre segunda conta para o mesmo Gmail “parecido”.
 */
export function canonicalSignupEmail(normalizedLower: string): string {
  const n = normalizedLower.trim().toLowerCase()
  const at = n.lastIndexOf("@")
  if (at <= 0) return n
  const localRaw = n.slice(0, at)
  const domain = n.slice(at + 1)
  const dom =
    domain === "googlemail.com" ? "gmail.com" : domain === "googlemail.com.br" ? "gmail.com" : domain
  if (dom !== "gmail.com") return `${localRaw}@${domain}`
  const plus = localRaw.split("+")[0] ?? localRaw
  const noDots = plus.replace(/\./g, "")
  return `${noDots}@gmail.com`
}

export function emailsEquivalentForSignup(a: string, b: string): boolean {
  const na = canonicalSignupEmail(normalizeSignupEmail(a))
  const nb = canonicalSignupEmail(normalizeSignupEmail(b))
  return na === nb
}

/** Somente dígitos. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "")
}

/**
 * BR: chave nacional (10 ou 11 dígitos, com DDD) para comparar telefones com formatações diferentes e com/sem 55.
 */
export function phoneNationalKeyBrazil(raw: string): string | null {
  let d = digitsOnly(raw)
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2)
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  if (d.length === 10 || d.length === 11) return d
  return null
}
