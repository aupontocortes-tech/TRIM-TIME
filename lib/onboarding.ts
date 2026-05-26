import { TRIAL_DAYS } from "@/lib/plans"

/** Dias para manter login/configurações após recusar contratar no fim do trial. */
export const TRIAL_GRACE_DAYS_AFTER_DECLINE = 14

export type SignupFlowStep = "dados" | "otp" | "barbearia" | "assinatura"

export const SIGNUP_STEPS: { id: SignupFlowStep; label: string }[] = [
  { id: "dados", label: "Seus dados" },
  { id: "otp", label: "Verificação" },
  { id: "barbearia", label: "Barbearia" },
  { id: "assinatura", label: "Ativar plano" },
]

export function trialTrustBullets(trialDays: number = TRIAL_DAYS): readonly string[] {
  return [
    "R$ 0 hoje — nenhuma cobrança agora.",
    `Após ${trialDays} dias, cobrança automática no cartão (Plano Pro).`,
    `Cancele até o dia ${trialDays} em Assinatura — sem cobrança.`,
  ] as const
}

export function signupStepIndex(step: SignupFlowStep): number {
  return SIGNUP_STEPS.findIndex((s) => s.id === step)
}
