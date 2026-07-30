/** Valida URL + service_role antes de chamar o Supabase Storage. */
export function getSupabaseServiceConfig():
  | { ok: true; url: string; key: string }
  | { ok: false; error: string; hint?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""

  if (!url || !key) {
    const missing: string[] = []
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY")
    return {
      ok: false,
      error: `Supabase Storage: falta ${missing.join(" e ")} no ambiente atual.`,
      hint: key
        ? "Confira NEXT_PUBLIC_SUPABASE_URL na Vercel (Production). Depois de alterar variáveis, faça Redeploy."
        : "Na Vercel, SUPABASE_SERVICE_ROLE_KEY precisa estar marcada em Production (não só Pre-Production). Cole a service_role do Supabase → API Keys → Legacy → Reveal. Depois: Deployments → Redeploy (obrigatório).",
    }
  }

  if (key.startsWith("$aact_")) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY está com a chave do Asaas, não do Supabase.",
      hint:
        "No Supabase → Project Settings → API → Legacy → service_role (Reveal). Cole em SUPABASE_SERVICE_ROLE_KEY (começa com eyJ…). A chave Asaas fica só em ASAAS_API_KEY.",
    }
  }

  const looksLikeSupabaseKey =
    key.startsWith("eyJ") || key.startsWith("sb_secret_") || key.startsWith("sbp_")
  if (!looksLikeSupabaseKey) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY inválida para o Supabase.",
      hint:
        "Copie a chave service_role em Supabase → Project Settings → API (Legacy → service_role, ou Secret keys → sb_secret_…).",
    }
  }

  return { ok: true, url, key }
}

export const SUPABASE_STORAGE_SETUP_HINT =
  'Rode também supabase/migrations/036_help_tutorial_videos_storage_bucket.sql no SQL Editor do Supabase (cria o bucket "help-tutorial-videos").'
