import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const KEY_LEN = 64

export function hashPassword(password: string): string {
  const normalized = String(password ?? "")
  if (!normalized) throw new Error("Senha obrigatória")
  const salt = randomBytes(16).toString("hex")
  const derived = scryptSync(normalized, salt, KEY_LEN).toString("hex")
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, encoded: string | null | undefined): boolean {
  const normalized = String(password ?? "")
  if (!normalized || !encoded) return false
  const [algo, salt, expected] = encoded.split("$")
  if (algo !== "scrypt" || !salt || !expected) return false
  const actual = scryptSync(normalized, salt, KEY_LEN)
  const expectedBuf = Buffer.from(expected, "hex")
  if (actual.length !== expectedBuf.length) return false
  return timingSafeEqual(actual, expectedBuf)
}
