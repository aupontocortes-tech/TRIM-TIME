import webpush from "web-push"

export type WebPushPayload = {
  title: string
  body: string
  /** Abre ao tocar na notificação (path ou URL absoluta). */
  url: string
}

/**
 * Envia Web Push ao cliente (PWA). Requer VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY no servidor
 * e NEXT_PUBLIC_VAPID_PUBLIC_KEY igual à pública no cliente.
 */
export async function sendWebPushToClient(
  subscription: unknown,
  data: WebPushPayload
): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  if (subscription == null || typeof subscription !== "object") {
    return { ok: false, skipped: "no_subscription" }
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey?.trim() || !privateKey?.trim()) {
    return { ok: false, error: "vapid_not_configured" }
  }
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contato@trimtime.app"
  webpush.setVapidDetails(subject, publicKey, privateKey)
  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(data),
      { TTL: 86_400 }
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "push_failed" }
  }
}
