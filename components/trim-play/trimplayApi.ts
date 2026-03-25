export async function submitTrimPlayScore(input: {
  barbershopId: string
  clienteId: string
  clienteName: string
  score: number
}) {
  const res = await fetch("/api/trimplay/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      barbershop_id: input.barbershopId,
      cliente_id: input.clienteId,
      cliente_name: input.clienteName,
      score: input.score,
    }),
    credentials: "include",
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data?.error === "string" ? data.error : "Erro ao enviar pontuação")
  }

  return (await res.json().catch(() => ({}))) as unknown
}

export async function fetchTrimPlayRanking(input: {
  barbershopId: string
  clienteId?: string
}) {
  const url = new URL("/api/trimplay/ranking", window.location.origin)
  url.searchParams.set("barbershop_id", input.barbershopId)
  if (input.clienteId) url.searchParams.set("cliente_id", input.clienteId)

  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data?.error === "string" ? data.error : "Erro ao buscar ranking")
  }

  return (await res.json()) as {
    top: { rank: number; cliente_id: string; cliente_nome: string; score: number }[]
    my: null | { cliente_id: string; score: number; rank: number }
  }
}

