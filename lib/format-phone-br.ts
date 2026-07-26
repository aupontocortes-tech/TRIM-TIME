/** Formata telefone BR para exibição: (DD) 99999-9999 */

export function stripBrazilPhoneDigits(value: string): string {
  let numbers = value.replace(/\D/g, "")
  // Usuário digitou com DDI 55 — usar só DDD + número (11 dígitos)
  if (numbers.startsWith("55") && numbers.length > 11) {
    numbers = numbers.slice(2)
  }
  return numbers.slice(0, 11)
}

export function formatPhoneBr(value: string): string {
  const numbers = stripBrazilPhoneDigits(value)
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : ""
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}
