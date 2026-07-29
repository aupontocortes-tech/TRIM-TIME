/** Normalização de telefone WhatsApp — sem dependência de servidor (safe no client). */

export function normalizeWhatsappPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

/**
 * Dígitos com DDI para a Graph API (WhatsApp Cloud).
 * Brasil: números 10/11 dígitos (DDD+número) ganham prefixo 55.
 */
export function whatsappDigitsForCloudApi(raw: string): string | null {
  const d = normalizeWhatsappPhoneDigits(raw)
  if (d.length < 10) return null
  // Já inclui DDI 55 — nunca prefixar de novo; BR exige 12 (fixo) ou 13 (celular) dígitos
  if (d.startsWith("55")) return d.length >= 12 ? d : null
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12) return d
  return null
}

/**
 * Candidatos para checkWhatsapp (BR): celular com/sem o 9 após o DDD.
 * WhatsApp antigo pode estar no formato 55+DDD+8 dígitos; cadastro novo usa 9+8.
 */
export function brWhatsappCheckCandidates(raw: string): string[] {
  const primary = whatsappDigitsForCloudApi(raw)
  if (!primary) return []
  const out = [primary]
  if (primary.startsWith("55") && primary.length === 13 && primary[4] === "9") {
    out.push(primary.slice(0, 4) + primary.slice(5))
  } else if (primary.startsWith("55") && primary.length === 12) {
    out.push(primary.slice(0, 4) + "9" + primary.slice(4))
  }
  return [...new Set(out)]
}

/** Dígitos com DDI 55 para wa.me (Brasil). */
export function whatsappDigitsForWaMe(raw: string): string | null {
  return whatsappDigitsForCloudApi(raw)
}

export function buildLandingWhatsappUrl(phoneDigits: string): string {
  const d = whatsappDigitsForWaMe(phoneDigits)
  if (!d) return ""
  const text = encodeURIComponent("Olá! Tenho dúvidas sobre o Trim Time.")
  return `https://wa.me/${d}?text=${text}`
}
