import { NextResponse } from "next/server"

/** Slug público da página de agendamento (/b/[slug]) */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i

/**
 * Manifest PWA só para quem instala a partir da página do cliente (/b/slug).
 * O manifest padrão do site (public/manifest.json) é para o barbeiro (abre /painel).
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")?.trim() ?? ""
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 })
  }

  const manifest = {
    id: `trimtime-agendar-${slug}`,
    name: "Trim Time - Agendamento",
    short_name: "Agendar",
    description: "Agende seu horário na barbearia",
    start_url: `/b/${encodeURIComponent(slug)}`,
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#c9a227",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
