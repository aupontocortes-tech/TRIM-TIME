import { TRIMPLAY_AUDIO_BUCKET } from "@/lib/trimplay-audio-constants"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export type SupabaseAuthUsage = {
  mau: number
  googleSignIns: number
  source: "database"
}

export type SupabaseStorageUsage = {
  bytes: number
  mb: number
  objectCount: number
  source: "api" | "database"
}

function monthStartUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** MAU aproximado: usuários Auth com login neste mês (UTC). */
export async function fetchSupabaseAuthUsage(): Promise<SupabaseAuthUsage | null> {
  const since = monthStartUtc()
  try {
    const [mauRows, googleRows] = await Promise.all([
      prisma.$queryRaw<{ cnt: number }[]>`
        SELECT COUNT(*)::int AS cnt
        FROM auth.users
        WHERE last_sign_in_at IS NOT NULL
          AND last_sign_in_at >= ${since}
      `,
      prisma.$queryRaw<{ cnt: number }[]>`
        SELECT COUNT(DISTINCT u.id)::int AS cnt
        FROM auth.users u
        INNER JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'google'
        WHERE u.last_sign_in_at IS NOT NULL
          AND u.last_sign_in_at >= ${since}
      `,
    ])
    const mau = mauRows[0]?.cnt ?? 0
    const googleSignIns = googleRows[0]?.cnt ?? 0
    return { mau, googleSignIns, source: "database" }
  } catch {
    return null
  }
}

async function listFolderBytes(
  supabase: ReturnType<typeof createServiceRoleClient>,
  prefix: string
): Promise<{ bytes: number; count: number }> {
  let bytes = 0
  let count = 0
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(TRIMPLAY_AUDIO_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error || !data?.length) break

    for (const item of data) {
      if (item.id) {
        bytes += item.metadata?.size ?? 0
        count += 1
      } else if (item.name) {
        const childPath = prefix ? `${prefix}/${item.name}` : item.name
        const nested = await listFolderBytes(supabase, childPath)
        bytes += nested.bytes
        count += nested.count
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return { bytes, count }
}

/** Uso do bucket trimplay-audio no Supabase Storage. */
export async function fetchSupabaseStorageUsage(): Promise<SupabaseStorageUsage | null> {
  try {
    const supabase = createServiceRoleClient()
    const { bytes, count } = await listFolderBytes(supabase, "")
    return {
      bytes,
      mb: Math.round((bytes / 1024 / 1024) * 10) / 10,
      objectCount: count,
      source: "api",
    }
  } catch {
    return null
  }
}
