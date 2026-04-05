import { NextResponse } from "next/server"

/**
 * Chave pública VAPID para o cliente registrar Web Push (segura para expor).
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: "Push não configurado no servidor (NEXT_PUBLIC_VAPID_PUBLIC_KEY)" },
      { status: 503 }
    )
  }
  return NextResponse.json({ publicKey: key })
}
