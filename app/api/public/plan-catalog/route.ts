import { NextResponse } from "next/server"
import { getPlanCatalog } from "@/lib/plan-catalog"

export async function GET() {
  try {
    const catalog = await getPlanCatalog()
    return NextResponse.json(catalog)
  } catch (e) {
    console.error("[public/plan-catalog]", e)
    return NextResponse.json({ error: "Erro ao carregar planos" }, { status: 500 })
  }
}
