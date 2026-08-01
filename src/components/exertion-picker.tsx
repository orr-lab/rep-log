"use client";

import { cn } from "@/lib/utils";

const LABELS = [
  "Very easy",
  "Easy",
  "Moderate",
  "Somewhat hard",
  "Hard",
  "Harder",
  "Very hard",
  "Really hard",
  "Near max",
  "Max effort",
];

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

export function ExertionPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1">
        {LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
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
