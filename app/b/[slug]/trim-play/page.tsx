"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { TrimPlayGame } from "@/components/trim-play/TrimPlayGame"
import { Button } from "@/components/ui/button"

type PublicShopPayload = {
  id: string
  name: string
}

/**
 * Abre o Trim Play direto no localhost (sem fluxo de agendamento).
 * Ex.: http://localhost:3000/b/meu-slug/trim-play
 */
export default function TrimPlayStandalonePage() {
  const params = useParams()
  const router = useRouter()
  const slug = (params?.slug as string) || ""

  const [shop, setShop] = useState<PublicShopPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cliente, setCliente] = useState<{ id: string; nome: string } | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`/api/public/barbershops/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Barbearia não encontrada" : "Erro ao carregar")
        return r.json()
      })
      .then((data: PublicShopPayload | null) => {
        if (cancelled || !data?.id || !data?.name) {
          if (!cancelled) setLoadError("Dados da barbearia incompletos")
          return
        }
        setShop(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar a barbearia")
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug || typeof window === "undefined") return
    const key = `trimplay_game_cliente_${slug}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; nome: string }
        if (parsed?.id && parsed?.nome) {
          setCliente(parsed)
          return
        }
      }
    } catch {
      // ignore
    }
    const id = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const nome = "Jogador"
    const payload = { id, nome }
    try {
      localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // ignore
    }
    setCliente(payload)
  }, [slug])

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-white">
        <p className="text-center text-white/80">{loadError}</p>
        <Button variant="outline" className="border-[#FFD700]/40 text-[#FFD700]" onClick={() => router.push(`/b/${encodeURIComponent(slug)}`)}>
          Voltar ao agendamento
        </Button>
      </div>
    )
  }

  if (!shop || !cliente) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
        Carregando Trim Play…
      </div>
    )
  }

  return (
    <TrimPlayGame
      barbershopId={shop.id}
      clienteId={cliente.id}
      clienteNome={cliente.nome}
      onExit={() => router.push(`/b/${encodeURIComponent(slug)}`)}
    />
  )
}
