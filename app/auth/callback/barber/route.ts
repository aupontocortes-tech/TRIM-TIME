import { NextRequest } from "next/server"
import { handleBarberOAuthCallbackGet } from "@/lib/auth/barber-oauth-callback-handler"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return handleBarberOAuthCallbackGet(request)
}
