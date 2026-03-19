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
    try {
      const [bsRes, subRes] = await Promise.all([
        fetch("/api/barbershops"),
        fetch("/api/subscriptions"),
      ])
      if (bsRes.ok && bsRes.status !== 204) {
        const data = await bsRes.json()
        if (data) setBarbershop(data)
        else setBarbershop(null)
      } else setBarbershop(null)
      if (subRes.ok && subRes.status !== 204) {
        const data = await subRes.json()
        if (data) setSubscription(data)
        else setSubscription(null)
      } else setSubscription(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar")
      setBarbershop(null)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const role: BarbershopRole =
    (barbershop as { role?: string } | null)?.role === "super_admin" ? "super_admin" : "admin_barbershop"
  const plan = getEffectivePlanForBarbershop(barbershop, subscription)

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
