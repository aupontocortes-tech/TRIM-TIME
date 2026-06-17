import { NextResponse } from "next/server"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import {
  getBarbershopPasswordHash,
  withBarbershopPasswordHash,
} from "@/lib/barbershop-auth-settings"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Define ou altera a senha da conta logada.
 * - Com senha existente: exige current_password.
 * - Sem senha (ex.: cadastro só com Google): basta new_password + confirm_password.
 */
export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      current_password?: string
      new_password?: string
      confirm_password?: string
    }

    const newPassword = String(body.new_password ?? "").trim()
    const confirmPassword = String(body.confirm_password ?? "").trim()
    const currentPassword = String(body.current_password ?? "")

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      )
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "A confirmação não coincide com a nova senha." }, { status: 400 })
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { id: true, settings: true, suspendedAt: true },
    })
    if (!shop) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
    }
    if (shop.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa" }, { status: 403 })
    }

    const storedHash = getBarbershopPasswordHash(shop.settings)
    if (storedHash) {
      if (!currentPassword.trim()) {
        return NextResponse.json(
          { error: "Informe a senha atual para alterar." },
          { status: 400 }
        )
      }
      if (!verifyPassword(currentPassword, storedHash)) {
        return NextResponse.json({ error: "Senha atual incorreta." }, { status: 403 })
      }
      if (verifyPassword(newPassword, storedHash)) {
        return NextResponse.json(
          { error: "A nova senha deve ser diferente da senha atual." },
          { status: 400 }
        )
      }
    }

    await prisma.barbershop.update({
      where: { id: shop.id },
      data: {
        settings: withBarbershopPasswordHash(shop.settings, hashPassword(newPassword)),
      },
    })

    return NextResponse.json({
      ok: true,
      has_password: true,
      message: storedHash ? "Senha alterada com sucesso." : "Senha definida. Agora você pode entrar com e-mail e senha.",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao alterar senha" },
      { status: 500 }
    )
  }
}
