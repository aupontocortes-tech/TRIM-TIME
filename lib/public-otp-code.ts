/**
 * Código OTP do Supabase Auth no e-mail: em geral só números, mas o projeto pode
 * usar OTP alfanumérico (Authentication → Providers → Email). Precisamos preservar letras.
 */
export const PUBLIC_OTP_LEN_MIN = 6
/** Limite superior conservador para dígitos longos ou OTP alfanumérico. */
export const PUBLIC_OTP_LEN_MAX = 10

export function normalizePublicOtpCode(raw: string): string {
  return String(raw ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, PUBLIC_OTP_LEN_MAX)
}

export function isPublicOtpLengthValid(len: number): boolean {
  return len >= PUBLIC_OTP_LEN_MIN && len <= PUBLIC_OTP_LEN_MAX
}
