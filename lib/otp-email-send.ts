/**
 * Envio do código OTP por e-mail via Resend (domínio verificado, ex. trimtime.pro).
 * Requer RESEND_API_KEY; remetente em OTP_EMAIL_FROM (padrão noreply@trimtime.pro).
 */

export type SendOtpCodeEmailParams = {
  to: string
  code: string
  subject?: string
  intro?: string
}

export type SendOtpCodeEmailResult = { ok: true } | { ok: false; error: string }

export function isResendOtpConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendOtpCodeEmail(
  params: SendOtpCodeEmailParams
): Promise<SendOtpCodeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: "resend_not_configured" }
  }

  const from = process.env.OTP_EMAIL_FROM?.trim() || "Trim Time <noreply@trimtime.pro>"
  const subject = params.subject ?? "Seu código Trim Time"
  const intro =
    params.intro ?? "Use o código abaixo para continuar. Ele vale por cerca de 10 minutos."

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html: [
        `<h2 style="font-family:sans-serif">${escapeHtml(subject)}</h2>`,
        `<p style="font-family:sans-serif">${escapeHtml(intro)}</p>`,
        `<p style="font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:6px;margin:24px 0">${escapeHtml(params.code)}</p>`,
        `<p style="font-family:sans-serif;color:#666;font-size:14px">Se você não pediu este código, ignore este e-mail.</p>`,
      ].join(""),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[otp-email] Resend HTTP", res.status, body.slice(0, 500))
    return {
      ok: false,
      error: "Não foi possível enviar o e-mail. Confira RESEND_API_KEY e o domínio na Resend.",
    }
  }

  return { ok: true }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
