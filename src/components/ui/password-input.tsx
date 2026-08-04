"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Deliberately uncontrolled -- the DOM input's value is the single source of truth, not React
// state. A password manager or the browser's own autofill sets that DOM value directly, without
// firing a normal input/change event. If this were a *controlled* input (`value={state}`), React
// compares its (stale, autofill-unaware) state against the live DOM value on every render, and
// forcibly overwrites the DOM back to that stale value the moment ANYTHING else on the page
// re-renders -- typing in a sibling field, any parent state update, not just clicking the reveal
// button -- silently wiping the autofilled password before the user notices. Making it
// uncontrolled removes that entire class of bug instead of racing browser-specific autofill
// detection (the CSS `:autofill` pseudo-class fires at different times, or not at all for some
// autofill paths, across engines -- notably Firefox). Read the real value via `name` + FormData
// on submit, same as any other uncontrolled form field.
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "value">) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 z-10 -translate-y-1/2 touch-manipulation text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}

export { PasswordInput }
