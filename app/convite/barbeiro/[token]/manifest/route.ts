import { NextResponse } from "next/server"

/**
 * Manifest dinâmico por token para “instalar” a página de cadastro do barbeiro como PWA no celular.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const rawBase = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const base = rawBase.replace(/\/$/, "")
  const startUrl =
    base.length > 0
      ? `${base}/convite/barbeiro/${encodeURIComponent(token)}`
      : `/convite/barbeiro/${encodeURIComponent(token)}`

  const manifest = {
    name: "Trim Time — Cadastro profissional",
    short_name: "Trim Profissional",
    description:
      "Mini app: cadastro na equipe. Depois use o app Agenda para ver horários e comissão (Google ou código por e-mail).",
    id: `trimtime-barber-invite-${token.slice(0, 12)}`,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0c0c",
    theme_color: "#0c0c0c",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  })
}
