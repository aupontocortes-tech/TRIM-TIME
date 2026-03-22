import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict } from "@/lib/scheduling"
import { saleCommissionAmount } from "@/lib/commissions"
import type { Appointment, AppointmentStatus } from "@/lib/db/types"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as {
      status?: AppointmentStatus
      total_price?: number
      date?: string
      time?: string
      barber_id?: string
      service_id?: string
    }
    const supabase = createServiceRoleClient()

    const { data: before, error: beforeErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
      .single()
    if (beforeErr || !before) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }

    const nextDate = body.date ?? (before as Appointment).date
    const nextTime = body.time ?? (before as Appointment).time
    const nextBarberId = body.barber_id ?? (before as Appointment).barber_id

    if (
      body.date !== undefined ||
      body.time !== undefined ||
      body.barber_id !== undefined
    ) {
      const conflict = await hasBarberSlotConflict(supabase, {
        barbershopId,
        barberId: nextBarberId,
        date: nextDate,
        time: nextTime,
        excludeAppointmentId: id,
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Este horário já está ocupado para o barbeiro escolhido." },
          { status: 409 }
        )
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) updates.status = body.status
    if (body.total_price !== undefined) updates.total_price = body.total_price
    if (body.date !== undefined) updates.date = body.date
    if (body.time !== undefined) updates.time = body.time
    if (body.barber_id !== undefined) updates.barber_id = body.barber_id
    if (body.service_id !== undefined) updates.service_id = body.service_id

    const finalPrice =
      body.total_price !== undefined
        ? Number(body.total_price)
        : Number((before as Appointment).total_price) || 0

    if (body.status === "completed" && (before as Appointment).status !== "completed") {
      const { data: barber } = await supabase
        .from("barbers")
        .select("commission")
        .eq("id", nextBarberId)
        .eq("barbershop_id", barbershopId)
        .single()
      const pct = Number(barber?.commission) || 0
      updates.commission_percent = pct
      updates.commission_amount = saleCommissionAmount(finalPrice, pct)
    }

    const { data, error } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
      .select("*, client:clients(*), barber:barbers(*), service:services(*)")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })

    if (body.status === "canceled") {
      await notifyFirstWaitingList(supabase, barbershopId, data as Appointment)
    }
    return NextResponse.json(data as Appointment)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

async function notifyFirstWaitingList(supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>, barbershopId: string, appointment: Appointment) {
  const { data: first } = await supabase
    .from("waiting_list")
    .select("id, client_id, service_id")
    .eq("barbershop_id", barbershopId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
  if (!first) return
  await supabase
    .from("waiting_list")
    .update({
      status: "notified",
      notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", first.id)
  await supabase.from("notification_log").insert({
    barbershop_id: barbershopId,
    client_id: first.client_id,
    appointment_id: appointment.id,
    type: "push",
    event: "waiting_list_slot_available",
    payload: {
      date: appointment.date,
      time: appointment.time,
      service_id: appointment.service_id,
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const supabase = createServiceRoleClient()
    const { data: appointment } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
      .single()
    if (appointment) await notifyFirstWaitingList(supabase, barbershopId, appointment as Appointment)
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
