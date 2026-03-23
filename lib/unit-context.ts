import type { SupabaseClient } from "@supabase/supabase-js"
import { getBarbershopUnitIdFromRequest } from "@/lib/tenant"

/**
 * Resolve unidade selecionada no request. Se cookie estiver inválido para a barbearia,
 * retorna null (modo "todas as unidades").
 */
export async function resolveSelectedUnitId(
  supabase: SupabaseClient,
  barbershopId: string
): Promise<string | null> {
  const unitId = await getBarbershopUnitIdFromRequest()
  if (!unitId) return null

  const { data } = await supabase
    .from("barbershop_units")
    .select("id")
    .eq("id", unitId)
    .eq("barbershop_id", barbershopId)
    .maybeSingle()

  return data?.id ?? null
}

