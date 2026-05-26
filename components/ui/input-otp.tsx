'use client'

import * as React from 'react'
import { OTPInput, OTPInputContext } from 'input-otp'
import { MinusIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'flex items-center gap-1 has-disabled:opacity-60',
        containerClassName,
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn('flex flex-nowrap items-center gap-1', className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'relative flex h-11 w-8 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/35 bg-muted text-center text-base font-semibold tabular-nums text-foreground shadow-sm transition-all outline-none sm:h-12 sm:w-10 sm:rounded-lg sm:text-lg min-[400px]:w-[2.375rem]',
        'dark:border-primary/45 dark:bg-zinc-800/95 dark:text-zinc-50',
        'data-[active=true]:z-10 data-[active=true]:border-primary data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:ring-2 data-[active=true]:ring-primary/35',
        'data-[active=true]:dark:bg-zinc-950 data-[active=true]:dark:ring-primary/50',
        'aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/30',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  )
}

export { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
