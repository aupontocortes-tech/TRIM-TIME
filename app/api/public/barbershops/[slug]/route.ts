import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchServicesForBarbershopRaw, serviceDbRowToApi } from "@/lib/service-queries"
import { fetchBarberPhotoPositionsByBarbershopId, fetchBarberPhotoScalesByBarbershopId } from "@/lib/barber-queries"
import type { BarbershopSettings } from "@/lib/db/types"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import { getWaitlistAcceptDeadlineMinutes } from "@/lib/waitlist-service"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"
import { loadUnitMapsUrlByBarbershopId } from "@/lib/barbershop-unit-maps"
import { isLoyaltyProgramActive, parseLoyaltyProgram } from "@/lib/loyalty-program"

/**
 * Dados públicos da barbearia (sem auth) — nome, contato/endereço da conta + unidades ativas.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const unitIdParam = new URL(req.url).searchParams.get("unit_id")?.trim() || null
    if (!slug?.trim()) {
      return NextResponse.json({ error: "slug obrigatório" }, { status: 400 })
    }

    const b = await prisma.barbershop.findUnique({
      where: { slug: slug.trim() },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        suspendedAt: true,
        settings: true,
        units: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            cep: true,
          },
          orderBy: { createdAt: "asc" },
        },
        barbers: {
          where: {
            active: true,
            ...(unitIdParam ? { unitId: unitIdParam } : {}),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            photoUrl: true,
            photoPosition: true,
            unitId: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!b || b.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const settings = (b.settings as BarbershopSettings | null) ?? null
    const shopMapsUrl = normalizeGoogleMapsUrl(settings?.maps_url)

    const unitMapsById = await loadUnitMapsUrlByBarbershopId(b.id)

    const plan = await resolveEffectivePlanForBarbershop(b.id)
    const waitlist_enabled = !!(plan && hasFeature(plan, "waiting_list"))
    const loyaltyConfig = parseLoyaltyProgram(settings)
    const loyalty_enabled = isLoyaltyProgramActive(settings, plan)

    const serviceRows = await fetchServicesForBarbershopRaw(b.id, {
      activeOnly: true,
      orderBy: "created_at",
    })

    let photoPositions = new Map<string, number>()
    let photoScales = new Map<string, number>()
    try {
      photoPositions = await fetchBarberPhotoPositionsByBarbershopId(b.id)
      photoScales = await fetchBarberPhotoScalesByBarbershopId(b.id)
    } catch {
      /* fallback abaixo com photoPosition do Prisma */
    }

    return NextResponse.json({
      id: b.id,
      name: b.name,
      slug: b.slug,
      phone: b.phone,
      address: settings?.address ?? null,
      city: settings?.city ?? null,
      state: settings?.state ?? null,
      cep: settings?.cep ?? null,
      maps_url: shopMapsUrl,
      opening_hours: settings?.opening_hours ?? null,
      booking_rules: settings?.booking_rules ?? null,
      waitlist_enabled,
      waitlist_accept_deadline_minutes: waitlist_enabled
        ? getWaitlistAcceptDeadlineMinutes(settings)
        : null,
      loyalty_enabled,
      loyalty_reward_label: loyalty_enabled ? loyaltyConfig?.reward_label ?? null : null,
      loyalty_visits_required: loyalty_enabled ? loyaltyConfig?.visits_required ?? null : null,
      units: b.units.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        address: u.address ?? settings?.address ?? null,
        city: u.city ?? settings?.city ?? null,
        state: u.state ?? settings?.state ?? null,
        cep: u.cep ?? settings?.cep ?? null,
        maps_url: unitMapsById.get(u.id) ?? shopMapsUrl,
      })),
      services: serviceRows.map((r) => {
        const s = serviceDbRowToApi(r)
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          price: s.price,
          duration: s.duration,
        }
      }),
      barbers: b.barbers.map((barber) => ({
        id: barber.id,
        unit_id: barber.unitId,
        name: barber.name,
        phone: barber.phone,
        photo_url: barber.photoUrl,
        photo_position: photoPositions.get(barber.id) ?? (barber as { photoPosition?: number }).photoPosition ?? 50,
        photo_scale: photoScales.get(barber.id) ?? (barber as { photoScale?: number }).photoScale ?? 100,
      })),
    })
  } catch (e) {
    console.error("[public/barbershops/slug]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    )
  }
}
