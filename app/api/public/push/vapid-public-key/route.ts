import { NextResponse } from "next/server"

/**
 * Chave pública VAPID para o cliente registrar Web Push (segura para expor).
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!key) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
  return NextResponse.json({ publicKey: key })
}
