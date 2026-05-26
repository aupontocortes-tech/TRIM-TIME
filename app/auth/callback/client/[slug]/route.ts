import { NextRequest } from "next/server"
import { handleClientOAuthCallbackGet } from "@/lib/auth/client-oauth-callback-handler"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login"
  return handleClientOAuthCallbackGet(request, slug, mode)
}
