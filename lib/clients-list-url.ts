/** URL da listagem de clientes — envia a unidade ativa na query (não depende só do cookie). */
export function clientsListUrl(selectedUnitId: string | null | undefined): string {
  const base = "/api/clients"
  if (selectedUnitId?.trim()) {
    return `${base}?unit_id=${encodeURIComponent(selectedUnitId.trim())}`
  }
  return base
}
