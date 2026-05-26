import type { BarbershopSettings } from "@/lib/db/types"
import type { Prisma } from "@prisma/client"

type PrivateAuthSettings = BarbershopSettings & {
  auth_password_hash?: string
  auth_password_set_at?: string
}

function asObject(input: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {}
}

export function getBarbershopPasswordHash(settings: Prisma.JsonValue | null | undefined): string | null {
  const obj = asObject(settings)
  return typeof obj.auth_password_hash === "string" && obj.auth_password_hash.trim()
    ? obj.auth_password_hash
    : null
}

export function withBarbershopPasswordHash(
  settings: Prisma.JsonValue | null | undefined,
  passwordHash: string
): Prisma.InputJsonValue {
  const obj = asObject(settings)
  obj.auth_password_hash = passwordHash
  obj.auth_password_set_at = new Date().toISOString()
  return obj as Prisma.InputJsonValue
}

export function sanitizeBarbershopSettings(
  settings: Prisma.JsonValue | null | undefined
): BarbershopSettings | null {
  const obj = asObject(settings)
  delete obj.auth_password_hash
  delete obj.auth_password_set_at
  if (Object.keys(obj).length === 0) return null
  return obj as BarbershopSettings
}
