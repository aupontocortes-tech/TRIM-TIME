import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { DashboardStats } from "@/lib/db/types"
import { fetchEffectivePlanForBarbershop } from "@/lib/barbershop-plan-server"
import { hasFeature } from "@/lib/plans"
import { aggregateCommissionsForRange } from "@/lib/commissions"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const today = new Date().toISOString().slice(0, 10)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10)

    const [appointmentsTodayRes, revenueTodayRes, revenueMonthRes, topBarberRes, newClientsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershopId)
        .eq("date", today)
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("appointments")
        .select("total_price")
        .eq("barbershop_id", barbershopId)
        .eq("date", today)
        .in("status", ["completed", "confirmed"]),
      supabase
        .from("appointments")
        .select("total_price")
        .eq("barbershop_id", barbershopId)
        .gte("date", startOfMonthStr)
        .in("status", ["completed", "confirmed"]),
      supabase
        .from("appointments")
        .select("barber_id")
        .eq("barbershop_id", barbershopId)
        .eq("date", today)
        .in("status", ["completed", "confirmed"]),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershopId)
        .gte("created_at", startOfMonth.toISOString()),
    ])

    const appointmentsToday = appointmentsTodayRes.count ?? 0
    const revenueToday =
      (revenueTodayRes.data ?? []).reduce((s, r) => s + (Number(r.total_price) || 0), 0)
    const revenueMonth =
      (revenueMonthRes.data ?? []).reduce((s, r) => s + (Number(r.total_price) || 0), 0)
    const newClientsMonth = newClientsRes.count ?? 0

    const barberCounts: Record<string, number> = {}
    for (const a of topBarberRes.data ?? []) {
      barberCounts[a.barber_id] = (barberCounts[a.barber_id] ?? 0) + 1
    }
    const topBarberEntry = Object.entries(barberCounts).sort((a, b) => b[1] - a[1])[0]
    let topBarber: DashboardStats["topBarber"] = null
    if (topBarberEntry) {
      const { data: barber } = await supabase
        .from("barbers")
        .select("name")
        .eq("id", topBarberEntry[0])
        .single()
      topBarber = {
        barber_id: topBarberEntry[0],
        barber_name: barber?.name ?? "Barbeiro",
        count: topBarberEntry[1],
      }
    }

    const plan = await fetchEffectivePlanForBarbershop(barbershopId)
    const commissionEnabled = !!(plan && hasFeature(plan, "barber_commission"))
    let commissionMonth = 0
    if (commissionEnabled) {
      const { total } = await aggregateCommissionsForRange(supabase, barbershopId, startOfMonthStr, today)
      commissionMonth = total
    }

    const stats: DashboardStats = {
      appointmentsToday,
      revenueToday,
      revenueMonth,
      topBarber,
      newClientsMonth,
      commissionMonth,
      commissionEnabled,
    }
    return NextResponse.json(stats)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar dashboard" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
