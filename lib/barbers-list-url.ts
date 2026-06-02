/** URL da listagem de equipe — unidade na query + versão para evitar resposta em cache. */
export function barbersListUrl(
  selectedUnitId: string | null | undefined,
  scopeVersion?: number
): string {
  const base = "/api/barbers"
  const params = new URLSearchParams()
  if (selectedUnitId?.trim()) {
    params.set("unit_id", selectedUnitId.trim())
  }
  if (scopeVersion != null && scopeVersion > 0) {
    params.set("_v", String(scopeVersion))
  }
  const q = params.toString()
  return q ? `${base}?${q}` : base
}
