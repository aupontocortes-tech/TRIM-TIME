"use client"

import { useState, useEffect, useCallback } from "react"
import type { Barbershop, Subscription } from "@/lib/db/types"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import type { BarbershopRole, SubscriptionPlan } from "@/lib/db/types"

interface BarbershopState {
  barbershop: Barbershop | null
  subscription: Subscription | null
  plan: SubscriptionPlan | null
  role: BarbershopRole
  loading: boolean
  error: string | null
  setBarbershop: (b: Barbershop | null) => void
  setSubscription: (s: Subscription | null) => void
  refetch: () => Promise<void>
}

export function useBarbershop(): BarbershopState {
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    let nextBarbershop: Barbershop | null = null
    let nextSubscription: Subscription | null = null
    let err: string | null = null

    // Barbearia e assinatura em sequência: falha na assinatura não apaga a barbearia.
    try {
      const bsRes = await fetch("/api/barbershops", {
        credentials: "include",
        cache: "no-store",
      })
      if (bsRes.ok && bsRes.status !== 204) {
        try {
          const data = (await bsRes.json()) as unknown
          if (
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
          ) {
            err = (data as { error: string }).error
            nextBarbershop = null
          } else if (data && typeof data === "object" && "id" in data) {
            nextBarbershop = data as Barbershop
          } else {
            nextBarbershop = null
          }
        } catch {
          err = "Resposta inválida ao carregar a barbearia."
          nextBarbershop = null
        }
      } else {
        try {
          const j = (await bsRes.json().catch(() => ({}))) as {
            error?: string
          }
          err =
            typeof j.error === "string"
              ? j.error
              : bsRes.status === 401
                ? "Sessão expirada ou não autenticado."
                : `Não foi possível carregar a barbearia (erro ${bsRes.status}).`
        } catch {
          err = `Não foi possível carregar a barbearia (erro ${bsRes.status}).`
        }
        nextBarbershop = null
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Erro de rede ao carregar a barbearia."
      nextBarbershop = null
    }

    try {
      const subRes = await fetch("/api/subscriptions", {
        credentials: "include",
        cache: "no-store",
      })
      if (subRes.ok && subRes.status !== 204) {
        try {
          const data = (await subRes.json()) as unknown
          if (
            data &&
            typeof data === "object" &&
            !("error" in data && (data as { error?: string }).error)
          ) {
            nextSubscription = data as Subscription
          }
        } catch {
          /* mantém null */
        }
      }
    } catch {
      /* assinatura opcional para UI se effective_plan já veio na barbearia */
    }

    setBarbershop(nextBarbershop)
    setSubscription(nextSubscription)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const role: BarbershopRole =
    (barbershop as { role?: string } | null)?.role === "super_admin" ? "super_admin" : "admin_barbershop"
  const plan =
    barbershop?.effective_plan ??
    getEffectivePlanForBarbershop(barbershop, subscription)

  return {
    barbershop: barbershop ? { ...barbershop, role } : null,
    subscription,
    plan,
    role,
    loading,
    error,
    setBarbershop,
    setSubscription,
    refetch,
  }
}
