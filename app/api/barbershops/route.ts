import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { hashPassword } from "@/lib/auth/password"
import { withBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { createTrialEndDate } from "@/lib/subscription"
import { getTrialConfig } from "@/lib/plan-catalog"
import { prisma } from "@/lib/prisma"
import { toBarbershopApi } from "@/lib/prisma-barbershop"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { conflictForBarbershopSignup } from "@/lib/barbershop-signup-conflicts"
import { canonicalSignupEmail, normalizeSignupEmail } from "@/lib/signup-identity"
import {
  PAINEL_SIGNUP_COOKIE,
  verifyPainelSignupSession,
} from "@/lib/painel-signup-session-cookie"
import type { Barbershop, BarbershopSettings } from "@/lib/db/types"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
    })
    if (!barbershop) {
      return NextResponse.json(null, { status: 404 })
    }
    if (barbershop.suspendedAt) {
      return NextResponse.json(
        { error: "Conta suspensa. Entre em contato com o suporte." },
        { status: 403 }
      )
    }
    const effectivePlan = await resolveEffectivePlanForActiveSession(barbershopId)
    return NextResponse.json({
      ...toBarbershopApi(barbershop),
      effective_plan: effectivePlan,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar barbearia" },
      { status: 500 }
    )
  }
}

/** Cadastro de nova barbearia: cria barbershop + trial. Exige OTP de e-mail válido (`painel_signup_token`). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string
      email: string
      phone?: string
      telefone?: string
      password?: string
      painel_signup_token?: string
    }
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 })
    }

    const emailCanonEarly = canonicalSignupEmail(normalizeSignupEmail(body.email))
    let passwordPlain = String(body.password ?? "").trim()
    if (!passwordPlain) {
      const jar = await cookies()
      const proof = verifyPainelSignupSession(jar.get(PAINEL_SIGNUP_COOKIE)?.value)
      if (proof && proof.e === emailCanonEarly && proof.x > Date.now()) {
        passwordPlain = crypto.randomBytes(24).toString("base64url")
      }
    }
    if (!passwordPlain || passwordPlain.length < 6) {
      return NextResponse.json(
        { error: "Informe uma senha com pelo menos 6 caracteres (ou conclua o cadastro com Google)." },
        { status: 400 }
      )
    }

    const hasTokenModel =
      typeof (prisma as unknown as { painelSignupToken?: { findUnique: unknown } }).painelSignupToken
        ?.findUnique === "function"
    if (!hasTokenModel) {
      return NextResponse.json(
        {
          error:
            "Servidor desatualizado: faltam modelos de cadastro no banco. Rode `npx prisma generate` e `npx prisma db push` e publique de novo.",
        },
        { status: 503 }
      )
    }

    const emailCanon = canonicalSignupEmail(normalizeSignupEmail(body.email))
    let signupToken = String(body.painel_signup_token ?? "").trim()
    if (!signupToken) {
      const jar = await cookies()
      const proof = verifyPainelSignupSession(jar.get(PAINEL_SIGNUP_COOKIE)?.value)
      const now = Date.now()
      if (proof && proof.e === emailCanon && proof.x > now) {
        signupToken = proof.t
      }
    }
    if (!signupToken) {
      return NextResponse.json(
        {
          error:
            "Confirme seu e-mail com o código (OTP) antes de criar a conta, ou conclua a verificação neste mesmo navegador.",
        },
        { status: 400 }
      )
    }

    const phoneCombined = String(body.phone ?? body.telefone ?? "").trim()
    const phone = phoneCombined || null
    const phoneDigitsLen = phoneCombined.replace(/\D/g, "").length

    const trialCfg = await getTrialConfig()
    const trialEnd = createTrialEndDate(trialCfg.days)

    const superEnv = process.env.SUPER_ADMIN_EMAIL?.trim()
    const isSuperAdmin =
      !!superEnv &&
      canonicalSignupEmail(normalizeSignupEmail(superEnv)) === emailCanon

    const barbershop = await prisma.$transaction(async (tx) => {
      const tokenRow = await tx.painelSignupToken.findUnique({
        where: { token: signupToken },
      })
      const tokenProblem =
        !tokenRow ||
        tokenRow.usedAt !== null ||
        tokenRow.email !== emailCanon ||
        tokenRow.expiresAt.getTime() <= Date.now()
      if (tokenProblem) {
        throw Object.assign(new Error("PAINEL_SIGNUP_TOKEN"), {
          code: "PAINEL_SIGNUP_TOKEN",
          message:
            tokenRow &&
            tokenRow.email === emailCanon &&
            tokenRow.usedAt === null &&
            tokenRow.expiresAt.getTime() <= Date.now()
              ? "Tempo para concluir o cadastro expirou. Confirme o e-mail novamente."
              : "E-mail não confirmado ou sessão inválida. Digite o código recebido por e-mail e tente de novo.",
        })
      }

      const conflict = await conflictForBarbershopSignup(tx, {
        email: emailCanon,
        phone: phoneDigitsLen >= 10 ? phone : null,
      })
      if (conflict === "email") {
        throw Object.assign(new Error("DUPE_EMAIL"), {
          code: "DUPE_EMAIL",
          message:
            "Já existe uma conta cadastrada com este e-mail (ou um Gmail equivalente). Faça login ou use outro e-mail.",
        })
      }
      if (conflict === "phone") {
        throw Object.assign(new Error("DUPE_PHONE"), {
          code: "DUPE_PHONE",
          message: "Já existe uma conta cadastrada com este telefone. Use outro número ou entre em contato com o suporte.",
        })
      }

      let slug = slugify(body.name.trim())
      const existingSlug = await tx.barbershop.findUnique({ where: { slug } })
      if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`

      const b = await tx.barbershop.create({
        data: {
          name: body.name.trim(),
          email: emailCanon,
          phone,
          slug,
          role: isSuperAdmin ? "super_admin" : "admin_barbershop",
          settings: withBarbershopPasswordHash(null, hashPassword(passwordPlain)),
        },
      })
      await tx.subscription.create({
        data: {
          barbershopId: b.id,
          plan: "pro",
          status: "trial",
          trialEnd,
        },
      })
      await tx.barbershopUnit.create({
        data: {
          barbershopId: b.id,
          name: b.name.trim(),
          active: true,
          createdAt: b.createdAt,
        },
      })
      await tx.painelSignupToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      })
      return b
    })

    const res = NextResponse.json(toBarbershopApi(barbershop))
    res.cookies.set(PAINEL_SIGNUP_COOKIE, "", { path: "/", maxAge: 0 })
    return res
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err?.code === "DUPE_EMAIL") {
      return NextResponse.json({ error: err.message ?? "E-mail já cadastrado." }, { status: 409 })
    }
    if (err?.code === "DUPE_PHONE") {
      return NextResponse.json({ error: err.message ?? "Telefone já cadastrado." }, { status: 409 })
    }
    if (err?.code === "PAINEL_SIGNUP_TOKEN") {
      return NextResponse.json({ error: err.message ?? "Confirme o e-mail." }, { status: 400 })
    }
    console.error("[barbershops POST]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cadastrar barbearia" },
      { status: 500 }
    )
  }
}

function mergeBarbershopSettings(
  prev: Prisma.JsonValue | null | undefined,
  inc: Partial<BarbershopSettings> | undefined
): Prisma.InputJsonValue | undefined {
  if (inc === undefined) return undefined
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {}
  if (inc.address !== undefined) base.address = inc.address
  if (inc.city !== undefined) base.city = inc.city
  if (inc.state !== undefined) base.state = inc.state
  if (inc.cep !== undefined) base.cep = inc.cep
  if (inc.maps_url !== undefined) {
    if (inc.maps_url) base.maps_url = inc.maps_url
    else delete base.maps_url
  }
  if (inc.opening_hours !== undefined) {
    const oldH =
      base.opening_hours && typeof base.opening_hours === "object" && !Array.isArray(base.opening_hours)
        ? (base.opening_hours as Record<string, unknown>)
        : {}
    base.opening_hours = { ...oldH, ...inc.opening_hours }
  }
  if (inc.booking_rules !== undefined) {
    const oldB =
      base.booking_rules &&
      typeof base.booking_rules === "object" &&
      !Array.isArray(base.booking_rules)
        ? (base.booking_rules as Record<string, unknown>)
        : {}
    base.booking_rules = {
      ...oldB,
      ...(inc.booking_rules as Record<string, unknown>),
    }
  }
  if (inc.notification_settings !== undefined) {
    const oldN =
      base.notification_settings &&
      typeof base.notification_settings === "object" &&
      !Array.isArray(base.notification_settings)
        ? (base.notification_settings as Record<string, unknown>)
        : {}
    base.notification_settings = {
      ...oldN,
      ...(inc.notification_settings as Record<string, unknown>),
    }
  }
  if (inc.waitlist_accept_deadline_minutes !== undefined) {
    base.waitlist_accept_deadline_minutes = inc.waitlist_accept_deadline_minutes
  }
  return base as Prisma.InputJsonValue
}

export async function PATCH(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as Partial<
      Pick<Barbershop, "name" | "email" | "phone"> & { settings?: Partial<BarbershopSettings> }
    >
    const current = await prisma.barbershop.findUnique({ where: { id: barbershopId } })
    if (!current) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }
    const mergedSettings = mergeBarbershopSettings(current.settings, body.settings)
    const barbershop = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(mergedSettings !== undefined && { settings: mergedSettings }),
      },
    })
    const effectivePlan = await resolveEffectivePlanForActiveSession(barbershopId)
    return NextResponse.json({
      ...toBarbershopApi(barbershop),
      effective_plan: effectivePlan,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar barbearia" },
      { status: 500 }
    )
  }
}
