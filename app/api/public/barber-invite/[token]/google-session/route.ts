import { NextResponse } from "next/server"
import { readBarberInviteGoogleFromRequest } from "@/lib/barber-invite-google-cookie"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const t = String(token ?? "").trim()
    if (t.length < 32) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const google = await readBarberInviteGoogleFromRequest(request)
    if (!google || google.inviteToken !== t) {
      return NextResponse.json({ verified: false })
    }

    return NextResponse.json({
      verified: true,
      email: google.email,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao ler sessão Google" },
      { status: 500 }
    )
  }
}
