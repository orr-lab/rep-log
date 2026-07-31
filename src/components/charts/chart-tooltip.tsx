"use client";

interface ChartTooltipPayloadItem {
  value?: number | string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueLabel,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {value} {valueLabel}
      </p>
    </div>
  );
}
