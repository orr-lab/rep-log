"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // Client/server render differs until hydration finishes (theme isn't known on the server) --
  // useSyncExternalStore's server snapshot always returns false, so this is false during SSR and
  // the first client render, then true from then on, without needing an effect to flip it.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" />;
  }

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
