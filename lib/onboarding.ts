import { TRIAL_DAYS } from "@/lib/plans"

/** Dias para manter login/configurações após recusar contratar no fim do trial. */
export const TRIAL_GRACE_DAYS_AFTER_DECLINE = 14

export type SignupFlowStep = "dados" | "otp" | "barbearia" | "assinatura"

export const SIGNUP_STEPS: { id: SignupFlowStep; label: string }[] = [
  { id: "dados", label: "Seus dados" },
  { id: "otp", label: "Verificação" },
  { id: "barbearia", label: "Barbearia" },
  { id: "assinatura", label: "Ativar teste" },
]

export function trialTrustBullets(trialDays: number = TRIAL_DAYS): readonly string[] {
  return [
    "Você não será cobrado agora.",
    `A cobrança só ocorrerá após os ${trialDays} dias gratuitos, se você aceitar continuar.`,
    "Cancele quando quiser.",
  ] as const
}

export function signupStepIndex(step: SignupFlowStep): number {
  return SIGNUP_STEPS.findIndex((s) => s.id === step)
}
