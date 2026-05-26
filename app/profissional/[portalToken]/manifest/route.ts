import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  const { portalToken } = await params
  const rawBase = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const base = rawBase.replace(/\/$/, "")
  const startUrl =
    base.length > 0
      ? `${base}/profissional/${encodeURIComponent(portalToken)}`
      : `/profissional/${encodeURIComponent(portalToken)}`

  return NextResponse.json(
    {
      name: "Trim Time — Meu trabalho",
      short_name: "Agenda",
      description: "Mini app: sua agenda, lista de espera e comissão na barbearia.",
      id: `trimtime-barber-app-${portalToken.slice(0, 8)}`,
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "private, max-age=300",
      },
    }
  )
}
