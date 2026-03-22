import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict } from "@/lib/scheduling"
import type { Appointment, AppointmentStatus } from "@/lib/db/types"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") // YYYY-MM-DD
    const barberId = searchParams.get("barber_id")
    const supabase = createServiceRoleClient()
    let query = supabase
      .from("appointments")
      .select("*, client:clients(*), barber:barbers(*), service:services(*)")
      .eq("barbershop_id", barbershopId)
      .order("time")
    if (date) query = query.eq("date", date)
    if (barberId) query = query.eq("barber_id", barberId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Appointment[])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = await request.json() as {
      client_id: string
      barber_id: string
      service_id: string
      date: string
      time: string
      total_price?: number
    }
    if (!body.client_id || !body.barber_id || !body.service_id || !body.date || !body.time) {
      return NextResponse.json(
        { error: "client_id, barber_id, service_id, date e time são obrigatórios" },
        { status: 400 }
      )
    }
    const supabase = createServiceRoleClient()
    // Um cliente só pode ter um agendamento por dia (excluindo cancelados)
    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("client_id", body.client_id)
      .eq("date", body.date)
      .neq("status", "canceled")
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Você já possui um agendamento neste dia. Cancele-o para poder fazer outro." },
        { status: 400 }
      )
    }
    const conflict = await hasBarberSlotConflict(supabase, {
      barbershopId,
      barberId: body.barber_id,
      date: body.date,
      time: body.time,
    })
    if (conflict) {
      return NextResponse.json(
        { error: "Este horário já está ocupado para o barbeiro escolhido." },
        { status: 409 }
      )
    }
    const { data: service } = await supabase
      .from("services")
      .select("price")
      .eq("id", body.service_id)
      .eq("barbershop_id", barbershopId)
      .single()
    const totalPrice = body.total_price ?? (service?.price ?? 0)
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        barbershop_id: barbershopId,
        client_id: body.client_id,
        barber_id: body.barber_id,
        service_id: body.service_id,
        date: body.date,
        time: body.time,
        status: "pending",
        total_price: totalPrice,
      })
      .select("*, client:clients(*), barber:barbers(*), service:services(*)")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Appointment)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar agendamento" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
