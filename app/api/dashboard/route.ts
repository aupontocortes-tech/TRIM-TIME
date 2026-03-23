import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { DashboardStats } from "@/lib/db/types"
import { fetchBarbershopPlanContext } from "@/lib/barbershop-plan-server"
import { canUseBarberCommission } from "@/lib/plans"
import { aggregateCommissionsForRange } from "@/lib/commissions"
import { resolveSelectedUnitId } from "@/lib/unit-context"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const selectedUnitId = await resolveSelectedUnitId(supabase, barbershopId)
    const today = new Date().toISOString().slice(0, 10)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10)

    let appointmentsTodayQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
      .eq("date", today)
      .in("status", ["pending", "confirmed"])
    let revenueTodayQuery = supabase
      .from("appointments")
      .select("total_price")
      .eq("barbershop_id", barbershopId)
      .eq("date", today)
      .in("status", ["completed", "confirmed"])
    let revenueMonthQuery = supabase
      .from("appointments")
      .select("total_price")
      .eq("barbershop_id", barbershopId)
      .gte("date", startOfMonthStr)
      .in("status", ["completed", "confirmed"])
    let topBarberQuery = supabase
      .from("appointments")
      .select("barber_id")
      .eq("barbershop_id", barbershopId)
      .eq("date", today)
      .in("status", ["completed", "confirmed"])

    if (selectedUnitId) {
      appointmentsTodayQuery = appointmentsTodayQuery.eq("unit_id", selectedUnitId)
      revenueTodayQuery = revenueTodayQuery.eq("unit_id", selectedUnitId)
      revenueMonthQuery = revenueMonthQuery.eq("unit_id", selectedUnitId)
      topBarberQuery = topBarberQuery.eq("unit_id", selectedUnitId)
    }

    const [appointmentsTodayRes, revenueTodayRes, revenueMonthRes, topBarberRes, newClientsRes] = await Promise.all([
      appointmentsTodayQuery,
      revenueTodayQuery,
      revenueMonthQuery,
      topBarberQuery,
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

    const { plan, barbershopRole } = await fetchBarbershopPlanContext(barbershopId)
    const commissionEnabled = canUseBarberCommission(plan, barbershopRole)
    let commissionMonth = 0
    if (commissionEnabled) {
      const { total } = await aggregateCommissionsForRange(
        supabase,
        barbershopId,
        startOfMonthStr,
        today,
        selectedUnitId
      )
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
