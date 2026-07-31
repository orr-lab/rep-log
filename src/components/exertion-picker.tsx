"use client";

import { cn } from "@/lib/utils";

const LABELS = ["Easy", "Moderate", "Hard", "Very hard", "Max effort"];

export function ExertionPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
              n <= value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-transparent text-muted-foreground hover:border-primary/50"
            )}
            aria-label={`Exertion ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{LABELS[value - 1]}</span>
    </div>
  );
}
