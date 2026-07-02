/**
 * E-mails transacionais para clientes (lembretes, confirmações) via Resend.
 */

export type ClientEmailSendResult = { ok: true } | { ok: false; error: string; skipped?: string }

export function isClientEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function plainTextToEmailHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="font-family:sans-serif;line-height:1.5;margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
  return paragraphs.join("") || `<p style="font-family:sans-serif">${escapeHtml(text)}</p>`
}

export async function sendClientNotificationEmail(params: {
  to: string
  subject: string
  bodyText: string
  barbershopName?: string
}): Promise<ClientEmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: "resend_not_configured", skipped: "resend_not_configured" }
  }

  const to = params.to.trim().toLowerCase()
  if (!to || !to.includes("@")) {
    return { ok: false, error: "client_no_email", skipped: "client_no_email" }
  }

  const from = process.env.OTP_EMAIL_FROM?.trim() || "Trim Time <noreply@trimtime.pro>"
  const shop = params.barbershopName?.trim()
  const footer = shop
    ? `Mensagem enviada por ${shop} via Trim Time.`
    : "Mensagem enviada via Trim Time."

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: params.subject.trim() || "Lembrete de agendamento",
      html: [
        plainTextToEmailHtml(params.bodyText),
        `<p style="font-family:sans-serif;color:#666;font-size:13px;margin-top:24px">${escapeHtml(footer)}</p>`,
      ].join(""),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[client-email] Resend HTTP", res.status, body.slice(0, 500))
    return { ok: false, error: "email_send_failed" }
  }

  return { ok: true }
}
