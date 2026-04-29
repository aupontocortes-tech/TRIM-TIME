/**
 * Envio do código OTP (4 dígitos) para cadastro/login do cliente no link público.
 * Produção: defina RESEND_API_KEY (https://resend.com). Sem chave, em dev loga no console.
 */

function htmlBody(shopName: string, code: string, minutes: number) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; background: #0a0a0a; color: #eee; padding: 24px;">
  <p style="color:#f5d76e;">${escapeHtml(shopName)}</p>
  <p>Seu código de verificação:</p>
  <p style="font-size: 28px; letter-spacing: 0.2em; font-weight: 700; color: #f5d76e;">${escapeHtml(code)}</p>
  <p style="color:#888;font-size:14px;">Válido por ${minutes} minutos. Se não foi você, ignore este e-mail.</p>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendClientOtpEmail(opts: {
  to: string
  shopName: string
  code: string
  expiresInMinutes: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Trim Time <onboarding@resend.dev>"

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error:
          "E-mail não configurado (RESEND_API_KEY). Defina na Vercel / .env para enviar códigos em produção.",
      }
    }
    console.info(`[OTP e-mail dev] para ${opts.to}: código ${opts.code} (${opts.shopName})`)
    return { ok: true }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `${opts.shopName}: seu código é ${opts.code}`,
        html: htmlBody(opts.shopName, opts.code, opts.expiresInMinutes),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" ? data.message : `Resend HTTP ${res.status}`,
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar e-mail" }
  }
}
