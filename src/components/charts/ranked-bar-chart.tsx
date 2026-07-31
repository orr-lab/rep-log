"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function RankedBarChart({
  data,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  valueLabel: string;
}) {
  const height = Math.max(160, data.length * 36);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fill: "var(--foreground)", fontSize: 13 }}
        />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip valueLabel={valueLabel} />} />
        <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="value" position="right" fill="var(--muted-foreground)" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
