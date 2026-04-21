/** Apenas dígitos (reconhecimento do cliente por telefone). */
export function clientPhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "")
}

/** Compara nome na entrada do cliente (login simples) com o cadastro. */
export function normalizeClienteNomeParaComparar(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Mesmo critério do link público: igualdade por dígitos ou pelos últimos 11 (DDD+número BR).
 */
export function clientPhonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = clientPhoneDigits(a)
  const db = clientPhoneDigits(b)
  if (da.length < 10 || db.length < 10) return false
  if (da === db) return true
  const na = da.length >= 11 ? da.slice(-11) : da
  const nb = db.length >= 11 ? db.slice(-11) : db
  return na.length >= 10 && nb.length >= 10 && na === nb
}
