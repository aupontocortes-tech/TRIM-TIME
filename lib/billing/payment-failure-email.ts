import { isResendOtpConfigured } from "@/lib/otp-email-send"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Avisa o dono da barbearia quando a cobrança do cartão falha ou fica em atraso. */
export async function sendPaymentProblemEmail(params: {
  to: string
  barbershopName: string
  detail: string
}): Promise<void> {
  if (!isResendOtpConfigured()) return

  const apiKey = process.env.RESEND_API_KEY!.trim()
  const from = process.env.OTP_EMAIL_FROM?.trim() || "Trim Time <noreply@trimtime.pro>"
  const subject = "Problema no pagamento da assinatura Trim Time"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://trimtime.pro"

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
        `<p style="font-family:sans-serif">Olá, <strong>${escapeHtml(params.barbershopName)}</strong>.</p>`,
        `<p style="font-family:sans-serif">${escapeHtml(params.detail)}</p>`,
        `<p style="font-family:sans-serif">Atualize o cartão em <a href="${escapeHtml(appUrl)}/painel/assinatura">Minha assinatura</a> para evitar interrupção do serviço.</p>`,
        `<p style="font-family:sans-serif;color:#666;font-size:14px">Se você já regularizou, ignore este e-mail.</p>`,
      ].join(""),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[billing-email] Resend HTTP", res.status, body.slice(0, 500))
  }
}
