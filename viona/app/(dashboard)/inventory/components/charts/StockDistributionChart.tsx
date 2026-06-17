"use client";

import { memo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1", "#d084d0"];

type Datum = { name: string; stock: number };

function StockDistributionChart({ data }: { data: Datum[] }) {
  const total = data.reduce((a, d) => a + d.stock, 0);
  const chart = data.map((d) => ({
    name: d.name,
    value: d.stock,
    pct: total > 0 ? (d.stock / total) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={chart} dataKey="value" outerRadius={85} label>
          {chart.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any, _n, p: any) => [`${v} (${p.payload.pct.toFixed(1)}%)`, "Stock"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default memo(StockDistributionChart);
