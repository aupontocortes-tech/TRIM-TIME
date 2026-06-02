import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** GET /api/deploy-check — confirma se o deploy na Vercel está na versão mais recente. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "trim-time",
    deploy_check: "vsl-test-2026-06-02",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    deployed_at: new Date().toISOString(),
  })
}
