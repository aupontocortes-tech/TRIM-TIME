import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { validateHelpTutorialsInput } from "@/lib/help-tutorials"
import { getHelpTutorialsConfig, saveHelpTutorialsConfig } from "@/lib/help-tutorials-server"

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const config = await getHelpTutorialsConfig({ includeInactive: true })
    return NextResponse.json(config)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar tutoriais" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const body = await request.json().catch(() => null)
    const parsed = validateHelpTutorialsInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const saved = await saveHelpTutorialsConfig(parsed.data)
    return NextResponse.json({ ok: true, ...saved })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar tutoriais" },
      { status: 500 }
    )
  }
}
