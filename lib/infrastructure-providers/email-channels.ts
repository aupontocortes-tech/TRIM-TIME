import { isResendOtpConfigured } from "@/lib/otp-email-send"
import { prisma } from "@/lib/prisma"

const SUPABASE_PLACEHOLDER = "****"

function monthStartUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export type EmailChannelCounts = {
  viaResend: number
  viaSupabase: number
  painelSignup: number
  clientPortal: number
  barberPortal: number
}

/** Separa envios OTP por canal (Resend API vs Supabase Auth/SMTP). */
export async function countEmailChannelsSince(since: Date): Promise<EmailChannelCounts> {
  const resendConfigured = isResendOtpConfigured()

  const [painelSignup, clientResend, clientSupabase, barberPortal] = await Promise.all([
    prisma.painelSignupOtpSend.count({ where: { createdAt: { gte: since } } }),
    prisma.clientOtpCode.count({
      where: {
        createdAt: { gte: since },
        NOT: { code: SUPABASE_PLACEHOLDER },
      },
    }),
    prisma.clientOtpCode.count({
      where: {
        createdAt: { gte: since },
        code: SUPABASE_PLACEHOLDER,
      },
    }),
    prisma.barberOtpCode.count({ where: { createdAt: { gte: since } } }),
  ])

  const painelViaResend = resendConfigured ? painelSignup : 0
  const painelViaSupabase = resendConfigured ? 0 : painelSignup

  return {
    viaResend: painelViaResend + clientResend,
    viaSupabase: painelViaSupabase + clientSupabase + barberPortal,
    painelSignup,
    clientPortal: clientResend + clientSupabase,
    barberPortal,
  }
}

export async function countEmailChannelsThisMonth(): Promise<EmailChannelCounts> {
  return countEmailChannelsSince(monthStartUtc())
}
