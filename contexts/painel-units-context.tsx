"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { BarbershopUnit } from "@/lib/db/types"

type UnitsContextValue = {
  units: BarbershopUnit[]
  selectedUnitId: string | null
  loading: boolean
  changeUnit: (unitId: string | null) => Promise<void>
  refetch: () => Promise<void>
}

const PainelUnitsContext = createContext<UnitsContextValue | null>(null)

/**
 * Um único estado de unidades para todo o painel — o seletor da sidebar e a tela de
 * Configurações passam a ver a mesma lista após criar/editar unidade.
 */
export function PainelUnitsProvider({ children }: { children: ReactNode }) {
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

  const changeUnit = useCallback(
    async (unitId: string | null) => {
      await fetch("/api/units/select", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: unitId }),
      })
      await refetch()
    },
    [refetch]
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  const value = useMemo(
    () => ({
      units,
      selectedUnitId,
      loading,
      changeUnit,
      refetch,
    }),
    [units, selectedUnitId, loading, changeUnit, refetch]
  )

  return <PainelUnitsContext.Provider value={value}>{children}</PainelUnitsContext.Provider>
}

export function usePainelUnits(): UnitsContextValue {
  const ctx = useContext(PainelUnitsContext)
  if (!ctx) {
    throw new Error("usePainelUnits must be used within PainelUnitsProvider")
  }
  return ctx
}
