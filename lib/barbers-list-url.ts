/** URL da listagem de equipe — envia a unidade ativa na query (não depende só do cookie). */
export function barbersListUrl(selectedUnitId: string | null | undefined): string {
  const base = "/api/barbers"
  if (selectedUnitId?.trim()) {
    return `${base}?unit_id=${encodeURIComponent(selectedUnitId.trim())}`
  }
  return base
}
