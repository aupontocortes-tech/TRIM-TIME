type GraphError = { error?: { message?: string } }

type GraphPhone = {
  id: string
  display_phone_number?: string
  verified_name?: string
}

export type WhatsAppMetaAssets = {
  phoneNumberId: string
  displayPhone: string
}

export type ResolveGraphPhoneNumberIdResult =
  | { ok: true; phoneNumberId: string; displayPhone?: string; correctedFromWaba: boolean }
  | { ok: false; error: string }

/** Textos alinhados aos rótulos da Meta (Etapa 1 / API Setup). */
export const META_WHATSAPP_ID_FIELD_COPY = {
  phoneNumberIdLabel: "Identificador do número de telefone",
  phoneNumberIdHint:
    "Na Meta (WhatsApp → Etapa 1), copie o ID do bloco do número (+55…). É o que o Trim Time usa para enviar mensagens.",
  wabaWarning:
    "Não use o ID da linha “Identificação da conta do WhatsApp Business” — esse é da conta (WABA), não do número.",
} as const

async function graphGet<T>(path: string, accessToken: string): Promise<T & GraphError> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as T & GraphError
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Graph API ${res.status}`)
  }
  return json
}

function pickPhone(phones: GraphPhone[] | undefined): WhatsAppMetaAssets | null {
  const p = phones?.find((row) => row.id?.trim())
  if (!p?.id) return null
  return {
    phoneNumberId: p.id.trim(),
    displayPhone: (p.display_phone_number ?? p.verified_name ?? "").trim(),
  }
}

async function phonesForWaba(wabaId: string, accessToken: string): Promise<WhatsAppMetaAssets | null> {
  const res = await graphGet<{ data?: GraphPhone[] }>(`${wabaId}/phone_numbers`, accessToken)
  return pickPhone(res.data)
}

async function looksLikePhoneNumberId(id: string, accessToken: string): Promise<WhatsAppMetaAssets | null> {
  try {
    const row = await graphGet<GraphPhone>(
      `${id}?fields=display_phone_number,verified_name`,
      accessToken
    )
    if (!row.display_phone_number && !row.verified_name) return null
    return {
      phoneNumberId: id.trim(),
      displayPhone: (row.display_phone_number ?? row.verified_name ?? "").trim(),
    }
  } catch {
    return null
  }
}

/**
 * Aceita Phone Number ID ou WABA ID colado por engano; sempre persiste o ID do número para envio.
 */
export async function resolveGraphPhoneNumberIdForSave(
  graphId: string,
  accessToken: string
): Promise<ResolveGraphPhoneNumberIdResult> {
  const id = graphId.trim()
  const token = accessToken.trim()
  if (!id || !token) {
    return { ok: false, error: "Informe o identificador e o token da Meta." }
  }

  const asPhone = await looksLikePhoneNumberId(id, token)
  if (asPhone) {
    return {
      ok: true,
      phoneNumberId: asPhone.phoneNumberId,
      displayPhone: asPhone.displayPhone,
      correctedFromWaba: false,
    }
  }

  const fromWaba = await phonesForWaba(id, token)
  if (fromWaba) {
    return {
      ok: true,
      phoneNumberId: fromWaba.phoneNumberId,
      displayPhone: fromWaba.displayPhone,
      correctedFromWaba: true,
    }
  }

  return {
    ok: false,
    error:
      "ID ou token inválido. Na Meta, copie o Identificador do número de telefone (bloco +55…) e um token EAA novo.",
  }
}

/** Converte token de curta duração em long-lived (quando possível). */
export async function exchangeMetaLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token")
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("fb_exchange_token", shortLivedToken)
  const res = await fetch(url.toString())
  const json = (await res.json()) as { access_token?: string; error?: { message?: string } }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? "Não foi possível obter token long-lived da Meta")
  }
  return json.access_token
}

/**
 * Descobre Phone Number ID e número exibido a partir do token do Embedded Signup.
 */
export async function resolveWhatsAppAssetsFromToken(
  accessToken: string
): Promise<WhatsAppMetaAssets | null> {
  try {
    const owned = await graphGet<{
      data?: Array<{
        owned_whatsapp_business_accounts?: { data?: Array<{ id: string }> }
      }>
    }>(
      "me/businesses?fields=owned_whatsapp_business_accounts{id}",
      accessToken
    )
    for (const biz of owned.data ?? []) {
      for (const waba of biz.owned_whatsapp_business_accounts?.data ?? []) {
        if (!waba.id) continue
        const assets = await phonesForWaba(waba.id, accessToken)
        if (assets) return assets
      }
    }
  } catch {
    /* tenta próximo caminho */
  }

  try {
    const businesses = await graphGet<{ data?: Array<{ id: string }> }>("me/businesses?fields=id", accessToken)
    for (const biz of businesses.data ?? []) {
      if (!biz.id) continue
      const clientWabas = await graphGet<{ data?: Array<{ id: string }> }>(
        `${biz.id}/client_whatsapp_business_accounts?fields=id`,
        accessToken
      )
      for (const waba of clientWabas.data ?? []) {
        if (!waba.id) continue
        const assets = await phonesForWaba(waba.id, accessToken)
        if (assets) return assets
      }
    }
  } catch {
    /* sem WABA encontrado */
  }

  return null
}
