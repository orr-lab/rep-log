"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

function PasswordInput({ className, onChange, ...props }: React.ComponentProps<"input">) {
  const [visible, setVisible] = React.useState(false)

  // See the onAutoFillStart keyframe in globals.css: browser autofill can set this field's
  // value without firing a normal input/change event, leaving React's controlled state stale.
  // Toggling visibility then re-renders the input with that stale value and wipes out the
  // autofilled password. Catching the animation this CSS hook triggers lets us sync state the
  // moment autofill happens, so show/hide reflects the real value either way.
  function handleAnimationStart(e: React.AnimationEvent<HTMLInputElement>) {
    if (e.animationName === "onAutoFillStart") {
      onChange?.({
        ...e,
        target: e.currentTarget,
        currentTarget: e.currentTarget,
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    }
  }

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-8", className)}
        onChange={onChange}
        onAnimationStart={handleAnimationStart}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-0.5 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}

export { PasswordInput }
