/** Normaliza CPF para somente dígitos; retorna null se vazio ou quantidade inválida. */
export function cpfDigits(input: string | null | undefined): string | null {
  const d = String(input ?? "").replace(/\D/g, "")
  if (!d) return null
  if (d.length !== 11) return null
  return d
}

export function formatCpfDisplay(digits: string | null | undefined): string {
  const d = String(digits ?? "").replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
