/** URL da listagem de clientes — cadastro é da rede inteira (sem filtro por unidade). */
export function clientsListUrl(_selectedUnitId?: string | null): string {
  return "/api/clients"
}
