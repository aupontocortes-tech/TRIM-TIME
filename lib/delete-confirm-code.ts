const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

/** Gera código de confirmação (sem I/O para evitar confusão visual). */
export function generateDeleteConfirmCode(length = 6): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return out
}

export function normalizeDeleteConfirmCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase()
}

export function deleteConfirmCodesMatch(expected: string, typed: string): boolean {
  const a = normalizeDeleteConfirmCode(expected)
  const b = normalizeDeleteConfirmCode(typed)
  return a.length > 0 && a === b
}

/** Ex.: "TRKXKY" → "T R K X K Y" */
export function formatDeleteConfirmCodeDisplay(code: string): string {
  return normalizeDeleteConfirmCode(code).split("").join(" ")
}
