"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"

type ReminderOption = { minutes: number; label: string }

type WhatsAppReminderTimesSettingsProps = {
  options: readonly ReminderOption[]
  selectedMinutes: number[]
  customHours: string
  onToggleMinute: (minutes: number) => void
  onCustomHoursChange: (value: string) => void
}

export function WhatsAppReminderTimesSettings({
  options,
  selectedMinutes,
  customHours,
  onToggleMinute,
  onCustomHoursChange,
}: WhatsAppReminderTimesSettingsProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 max-w-xl">
      <div>
        <p className="text-sm font-medium text-foreground">Quanto tempo antes avisar?</p>
        <p className="text-xs text-muted-foreground mt-0.5">Pode marcar mais de uma opção.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => (
          <label
            key={opt.minutes}
            className="flex items-center gap-3 cursor-pointer text-sm text-foreground"
          >
            <Checkbox
              checked={selectedMinutes.includes(opt.minutes)}
              onCheckedChange={() => onToggleMinute(opt.minutes)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <Field>
        <FieldLabel>Outro horário (horas antes) — opcional</FieldLabel>
        <Input
          type="number"
          min={1}
          max={168}
          className="mt-1 bg-input border-border text-foreground max-w-[160px]"
          value={customHours}
          onChange={(e) => onCustomHoursChange(e.target.value)}
          placeholder="Ex.: 3"
        />
      </Field>
    </div>
  )
}
