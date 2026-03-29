const AUTH_PREFIX = "__trimtime_auth__="

type ClientAuthMeta = {
  passwordHash?: string
}

export function parseClientNotes(notes: string | null | undefined): {
  visibleNotes: string | null
  auth: ClientAuthMeta
} {
  const raw = String(notes ?? "")
  if (!raw.startsWith(AUTH_PREFIX)) {
    return { visibleNotes: raw || null, auth: {} }
  }

  const newlineIdx = raw.indexOf("\n")
  const metaRaw = newlineIdx >= 0 ? raw.slice(AUTH_PREFIX.length, newlineIdx) : raw.slice(AUTH_PREFIX.length)
  const rest = newlineIdx >= 0 ? raw.slice(newlineIdx + 1).trim() : ""

  try {
    const parsed = JSON.parse(metaRaw) as ClientAuthMeta
    return {
      visibleNotes: rest || null,
      auth: parsed && typeof parsed === "object" ? parsed : {},
    }
  } catch {
    return { visibleNotes: raw || null, auth: {} }
  }
}

export function buildClientNotes(
  visibleNotes: string | null | undefined,
  auth: ClientAuthMeta
): string | null {
  const cleanVisible = String(visibleNotes ?? "").trim()
  const hasAuth = typeof auth.passwordHash === "string" && auth.passwordHash.trim().length > 0
  if (!hasAuth) return cleanVisible || null
  const meta = JSON.stringify({ passwordHash: auth.passwordHash })
  return cleanVisible ? `${AUTH_PREFIX}${meta}\n${cleanVisible}` : `${AUTH_PREFIX}${meta}`
}

export function sanitizeClientNotes(notes: string | null | undefined): string | null {
  return parseClientNotes(notes).visibleNotes
}
