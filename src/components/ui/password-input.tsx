"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

function PasswordInput({ className, onChange, value, ...props }: React.ComponentProps<"input">) {
  const [visible, setVisible] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // See the onAutoFillStart keyframe in globals.css: browser autofill can set this field's
  // value without firing a normal input/change event, leaving React's controlled state stale.
  // Toggling visibility then re-renders the input with that stale value and wipes out the
  // autofilled password. Catching the animation this CSS hook triggers lets us sync state the
  // moment autofill happens, so show/hide reflects the real value either way. Guarded against an
  // empty currentTarget.value: some browsers momentarily report the field as empty while they're
  // mid-transition on a type="password"/"text" swap, and re-fire this same animation in the
  // process (since toggling type re-evaluates the :autofill match) -- without the guard, that
  // transient empty read would silently wipe out an already-filled password on toggle.
  //
  // This is Chromium-flavored, though -- the `:autofill`/`:-webkit-autofill` match (and whether
  // it fires an animationstart at all) doesn't behave identically in every engine, Firefox
  // included. Rather than depend on that single signal, handleToggle below also reads the
  // input's actual live DOM value directly via ref the moment the button is clicked, and syncs
  // it in if it's drifted from the controlled value -- correct regardless of *how* or *whether*
  // the browser told us the field changed.
  function handleAnimationStart(e: React.AnimationEvent<HTMLInputElement>) {
    if (e.animationName === "onAutoFillStart" && e.currentTarget.value) {
      onChange?.({
        ...e,
        target: e.currentTarget,
        currentTarget: e.currentTarget,
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    }
  }

  function handleToggle() {
    const el = inputRef.current
    if (el && el.value !== value) {
      onChange?.({ target: el, currentTarget: el } as React.ChangeEvent<HTMLInputElement>)
    }
    setVisible((v) => !v)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        value={value}
        onChange={onChange}
        onAnimationStart={handleAnimationStart}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 z-10 -translate-y-1/2 touch-manipulation text-muted-foreground hover:text-foreground"
        onClick={handleToggle}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}

export { PasswordInput }
