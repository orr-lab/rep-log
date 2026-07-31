"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function TrendBarChart({
  data,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  valueLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis hide allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip valueLabel={valueLabel} />} />
        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
