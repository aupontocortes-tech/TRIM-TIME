"use client"

import { useCallback, useEffect, useState } from "react"
import type { BarbershopUnit } from "@/lib/db/types"

type UnitsState = {
  units: BarbershopUnit[]
  selectedUnitId: string | null
  loading: boolean
  changeUnit: (unitId: string | null) => Promise<void>
  refetch: () => Promise<void>
}

export function useUnits(): UnitsState {
  const [units, setUnits] = useState<BarbershopUnit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/units", { credentials: "include" })
      if (!r.ok) {
        setUnits([])
        setSelectedUnitId(null)
        return
      }
      const data = (await r.json()) as {
        units?: BarbershopUnit[]
        selected_unit_id?: string | null
      }
      setUnits(Array.isArray(data.units) ? data.units : [])
      setSelectedUnitId(typeof data.selected_unit_id === "string" ? data.selected_unit_id : null)
    } finally {
      setLoading(false)
    }
  }, [])

  const changeUnit = useCallback(async (unitId: string | null) => {
    await fetch("/api/units/select", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_id: unitId }),
    })
    await refetch()
  }, [refetch])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { units, selectedUnitId, loading, changeUnit, refetch }
}

