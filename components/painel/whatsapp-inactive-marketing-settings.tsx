"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { WhatsAppTemplateVarsPanel } from "@/components/painel/whatsapp-template-vars-panel"
import {
  DEFAULT_WHATSAPP_INACTIVE_FIRST,
  DEFAULT_WHATSAPP_INACTIVE_SECOND,
} from "@/lib/notification-default-templates"
import {
  INACTIVE_MARKETING_DEFAULT_FIRST_DAYS,
  INACTIVE_MARKETING_DEFAULT_SECOND_DAYS,
  INACTIVE_MARKETING_DEFAULT_STOP_DAYS,
} from "@/lib/inactive-client-marketing"

type WhatsAppInactiveMarketingSettingsProps = {
  waConnected: boolean
  firstDays: string
  secondDays: string
  stopDays: string
  firstTemplate: string
  secondTemplate: string
  onFirstDaysChange: (v: string) => void
  onSecondDaysChange: (v: string) => void
  onStopDaysChange: (v: string) => void
  onFirstTemplateChange: (v: string) => void
  onSecondTemplateChange: (v: string) => void
}

export function WhatsAppInactiveMarketingSettings({
  waConnected,
  firstDays,
  secondDays,
  stopDays,
  firstTemplate,
  secondTemplate,
  onFirstDaysChange,
  onSecondDaysChange,
  onStopDaysChange,
  onFirstTemplateChange,
  onSecondTemplateChange,
}: WhatsAppInactiveMarketingSettingsProps) {
  return (
    <div className="space-y-4">
      {!waConnected ? (
        <p className="text-sm text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          Conecte o WhatsApp acima para enviar as mensagens.
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <strong className="text-foreground font-medium">Como funciona:</strong>{" "}
        <span className="text-foreground/90">{firstDays || INACTIVE_MARKETING_DEFAULT_FIRST_DAYS} dias</span> sem
        visita → 1ª mensagem →{" "}
        <span className="text-foreground/90">{secondDays || INACTIVE_MARKETING_DEFAULT_SECOND_DAYS} dias</span> →
        2ª mensagem → depois de{" "}
        <span className="text-foreground/90">{stopDays || INACTIVE_MARKETING_DEFAULT_STOP_DAYS} dias</span> o sistema
        para de insistir.
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="inactive-first-days">1ª mensagem (dias)</FieldLabel>
          <Input
            id="inactive-first-days"
            type="number"
            min={7}
            max={365}
            placeholder={String(INACTIVE_MARKETING_DEFAULT_FIRST_DAYS)}
            className="mt-1 bg-input border-border"
            value={firstDays}
            onChange={(e) => onFirstDaysChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Ex.: 30 = 1 mês</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="inactive-second-days">2ª mensagem (dias)</FieldLabel>
          <Input
            id="inactive-second-days"
            type="number"
            min={7}
            max={365}
            placeholder={String(INACTIVE_MARKETING_DEFAULT_SECOND_DAYS)}
            className="mt-1 bg-input border-border"
            value={secondDays}
            onChange={(e) => onSecondDaysChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Ex.: 60 = 2 meses</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="inactive-stop-days">Parar após (dias)</FieldLabel>
          <Input
            id="inactive-stop-days"
            type="number"
            min={7}
            max={365}
            placeholder={String(INACTIVE_MARKETING_DEFAULT_STOP_DAYS)}
            className="mt-1 bg-input border-border"
            value={stopDays}
            onChange={(e) => onStopDaysChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Sem 3ª mensagem</p>
        </Field>
      </div>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Texto da 1ª mensagem</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => onFirstTemplateChange(DEFAULT_WHATSAPP_INACTIVE_FIRST)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Padrão
          </Button>
        </div>
        <Textarea
          className="mt-1 bg-input border-border text-foreground min-h-[100px]"
          value={firstTemplate}
          onChange={(e) => onFirstTemplateChange(e.target.value)}
        />
      </Field>
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Texto da 2ª mensagem</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => onSecondTemplateChange(DEFAULT_WHATSAPP_INACTIVE_SECOND)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Padrão
          </Button>
        </div>
        <Textarea
          className="mt-1 bg-input border-border text-foreground min-h-[100px]"
          value={secondTemplate}
          onChange={(e) => onSecondTemplateChange(e.target.value)}
        />
      </Field>

      <WhatsAppTemplateVarsPanel
        extraTags={[{ tag: "{{dias_sem_visita}}", desc: "Dias desde a última visita" }]}
      />
    </div>
  )
}
