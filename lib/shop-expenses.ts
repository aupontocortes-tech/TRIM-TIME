/** Categorias de despesa da loja (lançamentos `direction: out`). */
export const SHOP_EXPENSE_CATEGORIES = {
  produtos: "Compra de produtos",
  energia: "Energia elétrica",
  agua: "Água",
  aluguel: "Aluguel",
  internet: "Internet / telefone",
  salarios: "Salários / encargos",
  marketing: "Marketing",
  manutencao: "Manutenção",
  impostos: "Impostos / taxas",
  outros: "Outros",
} as const

export type ShopExpenseCategory = keyof typeof SHOP_EXPENSE_CATEGORIES

export function isShopExpenseCategory(v: string): v is ShopExpenseCategory {
  return v in SHOP_EXPENSE_CATEGORIES
}

export function shopExpenseCategoryLabel(category: string): string {
  if (isShopExpenseCategory(category)) return SHOP_EXPENSE_CATEGORIES[category]
  return category || "Despesa"
}

export function isLedgerOutDirection(direction: string): boolean {
  const d = direction.toLowerCase()
  return d === "out" || d === "saida" || d === "saída"
}

export type ShopExpenseRow = {
  id: string
  category: ShopExpenseCategory | string
  category_label: string
  amount: number
  note: string | null
  vendor: string | null
  occurred_at: string
  unit_id: string | null
  unit_name: string | null
}

export function ledgerEntryToExpense(row: {
  id: string
  category: string
  amount: unknown
  note: string | null
  vendor: string | null
  occurredAt: Date
  unitId: string | null
  unit?: { name: string } | null
}): ShopExpenseRow {
  return {
    id: row.id,
    category: row.category,
    category_label: shopExpenseCategoryLabel(row.category),
    amount: Math.round(Number(row.amount) * 100) / 100,
    note: row.note,
    vendor: row.vendor,
    occurred_at: row.occurredAt.toISOString().slice(0, 10),
    unit_id: row.unitId,
    unit_name: row.unit?.name ?? null,
  }
}
