import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { getHelpTutorialsConfig } from "@/lib/help-tutorials-server"

/** Tutoriais em vídeo para o painel da barbearia (somente leitura). */
export async function GET() {
  try {
    await requireBarbershopId()
    const config = await getHelpTutorialsConfig()
    return NextResponse.json(config)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
