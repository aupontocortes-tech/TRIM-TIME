/**
 * Multi-tenant: obter barbershop_id no backend (API routes / Server Components)
 */

import { cookies, headers } from "next/headers"

const BARBERSHOP_ID_COOKIE = "trimtime_barbershop_id"
export const IMPERSONATE_COOKIE = "trimtime_impersonate_id"

/** Usado em API routes e Server Components para obter o barbershop do request. Se impersonação ativa, retorna o id impersonado. */
export async function getBarbershopIdFromRequest(): Promise<string | null> {
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value
  if (impersonateId) return impersonateId
  const id = cookieStore.get(BARBERSHOP_ID_COOKIE)?.value
  if (id) return id
  const h = await headers()
  return h.get("x-barbershop-id") || null
}

/** Id real da sessão (ignora impersonação). Usado em APIs de admin para checar role. */
export async function getRealBarbershopIdFromRequest(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(BARBERSHOP_ID_COOKIE)?.value ?? null
}

/** Exige barbershop_id; lança se não houver (para usar em API que requer tenant) */
export async function requireBarbershopId(): Promise<string> {
  const id = await getBarbershopIdFromRequest()
  if (!id) throw new Error("Barbershop não identificada. Faça login.")
  return id
}

export { BARBERSHOP_ID_COOKIE }
