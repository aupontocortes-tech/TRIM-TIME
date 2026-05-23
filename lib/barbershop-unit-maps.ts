import { prisma } from "@/lib/prisma"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"

/**
 * Carrega links do Maps por unidade quando a coluna `maps_url` existe no banco.
 * Se a migration ainda não rodou em produção, retorna mapa vazio (não quebra a API pública).
 */
export async function loadUnitMapsUrlByBarbershopId(
  barbershopId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const rows = await prisma.barbershopUnit.findMany({
      where: { barbershopId, active: true },
      select: { id: true, mapsUrl: true },
    })
    for (const row of rows) {
      const url = normalizeGoogleMapsUrl(row.mapsUrl)
      if (url) map.set(row.id, url)
    }
  } catch (e) {
    console.warn("[barbershop-unit-maps] maps_url indisponível no banco:", e)
  }
  return map
}
