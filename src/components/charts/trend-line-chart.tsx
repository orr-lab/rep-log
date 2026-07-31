"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function TrendLineChart({
  data,
  valueLabel,
  domain,
}: {
  data: { label: string; value: number | null }[];
  valueLabel: string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          domain={domain}
          tickLine={false}
          axisLine={false}
          width={24}
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
