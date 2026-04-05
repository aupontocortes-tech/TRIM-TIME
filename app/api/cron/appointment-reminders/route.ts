import { NextResponse } from "next/server"
import { processAppointmentReminders } from "@/lib/process-appointment-reminders"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get("authorization")
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

/**
 * Vercel Cron (ou chamada manual com CRON_SECRET).
 * Agenda: configure em vercel.json e defina CRON_SECRET no projeto.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  try {
    const stats = await processAppointmentReminders()
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    console.error("[cron/appointment-reminders]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar lembretes" },
      { status: 500 }
    )
  }
}
