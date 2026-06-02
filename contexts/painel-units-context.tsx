"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { BarbershopUnit } from "@/lib/db/types"

type UnitsContextValue = {
  units: BarbershopUnit[]
  selectedUnitId: string | null
  /** Incrementa a cada troca de unidade — use em deps de fetch para evitar cache/condição de corrida. */
  unitScopeVersion: number
  loading: boolean
  changeUnit: (unitId: string | null) => Promise<boolean>
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
  const [unitScopeVersion, setUnitScopeVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const selectedRef = useRef<string | null>(null)

  useEffect(() => {
    selectedRef.current = selectedUnitId
  }, [selectedUnitId])

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/units", { credentials: "include", cache: "no-store" })
      if (!r.ok) {
        setUnits([])
        setSelectedUnitId(null)
        selectedRef.current = null
        return
      }
      const data = (await r.json()) as {
        units?: BarbershopUnit[]
        selected_unit_id?: string | null
      }
      setUnits(Array.isArray(data.units) ? data.units : [])
      const next =
        typeof data.selected_unit_id === "string" ? data.selected_unit_id : null
      setSelectedUnitId(next)
      selectedRef.current = next
    } finally {
      setLoading(false)
    }
  }, [])

  const changeUnit = useCallback(
    async (unitId: string | null): Promise<boolean> => {
      const prev = selectedRef.current
      setSelectedUnitId(unitId)
      selectedRef.current = unitId
      setUnitScopeVersion((v) => v + 1)

      try {
        const r = await fetch("/api/units/select", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unit_id: unitId }),
          cache: "no-store",
        })
        const data = (await r.json().catch(() => ({}))) as {
          ok?: boolean
          unit_id?: string | null
          error?: string
        }
        if (!r.ok) {
          setSelectedUnitId(prev)
          selectedRef.current = prev
          setUnitScopeVersion((v) => v + 1)
          return false
        }
        const confirmed =
          typeof data.unit_id === "string" ? data.unit_id : unitId
        setSelectedUnitId(confirmed)
        selectedRef.current = confirmed
        await refetch()
        return true
      } catch {
        setSelectedUnitId(prev)
        selectedRef.current = prev
        setUnitScopeVersion((v) => v + 1)
        return false
      }
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
      unitScopeVersion,
      loading,
      changeUnit,
      refetch,
    }),
    [units, selectedUnitId, unitScopeVersion, loading, changeUnit, refetch]
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
