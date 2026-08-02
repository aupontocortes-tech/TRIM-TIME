/** Apenas dígitos (reconhecimento do cliente por telefone). */
export function clientPhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "")
}

/** Parte local BR (sem DDI/DDD) para comparar celular com/sem 9º dígito. */
function brLocalMobileParts(digits: string): string[] {
  let local: string | null = null
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(4)
  } else if (digits.length === 11) {
    local = digits.slice(2)
  } else if (digits.length === 10) {
    local = digits.slice(2)
  }
  if (!local || local.length < 8) return []

  const parts = new Set<string>([local])
  if (local.length === 8 && local.startsWith("9")) {
    parts.add(`9${local}`)
  }
  if (local.length === 9 && local.startsWith("9")) {
    parts.add(local.slice(0, 8))
  }
  return [...parts]
}

/** Compara nome na entrada do cliente (login simples) com o cadastro. */
export function normalizeClienteNomeParaComparar(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Igualdade por dígitos BR, incluindo celular com/sem 9 após o DDD.
 * Green API pode enviar 556199346519 (12) enquanto o cadastro tem 61993465193 (11).
 */
export function clientPhonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = clientPhoneDigits(a)
  const db = clientPhoneDigits(b)
  if (da.length < 10 || db.length < 10) return false
  if (da === db) return true

  const na = da.length >= 11 ? da.slice(-11) : da
  const nb = db.length >= 11 ? db.slice(-11) : db
  if (na.length >= 10 && nb.length >= 10 && na === nb) return true

  const pa = brLocalMobileParts(da)
  const pb = brLocalMobileParts(db)
  for (const x of pa) {
    for (const y of pb) {
      if (x === y) return true
      if (x.length >= 8 && y.length >= 8 && (x.startsWith(y) || y.startsWith(x))) return true
    }
  }
  return false
}

/** @deprecated Use clientPhonesMatch; mantido para diagnósticos. */
export function brPhoneMatchKeys(raw: string | null | undefined): string[] {
  return brLocalMobileParts(clientPhoneDigits(raw))
}
