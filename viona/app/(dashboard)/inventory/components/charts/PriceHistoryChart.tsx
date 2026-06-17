"use client";

import { memo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Bar,
} from "recharts";

type Row = {
  id: string;
  retailPrice: number;
  actualPrice?: number;
  marketPrice?: number;
  validFrom: string;
};

function PriceHistoryChart({ data }: { data: Row[] }) {
  const chartData = [...data]
    .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())
    .map((p) => ({
      date: new Date(p.validFrom).toLocaleDateString(),
      retailPrice: p.retailPrice,
      actualPrice: p.actualPrice ?? 0,
      marketPrice: p.marketPrice ?? 0,
      margin: p.actualPrice ? ((p.retailPrice - p.actualPrice) / p.retailPrice) * 100 : 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="price" />
        <YAxis yAxisId="margin" orientation="right" />
        <Tooltip
          formatter={(value: any, name: string) =>
            name === "margin" ? [`${Number(value).toFixed(1)}%`, "Profit Margin"] : [`$${Number(value).toFixed(2)}`, name]
          }
        />
        <Legend />
        <Area yAxisId="price" type="monotone" dataKey="marketPrice" stackId="1" stroke="#ff7300" fill="#ff7300" fillOpacity={0.25} name="Market Price" />
        <Line yAxisId="price" type="monotone" dataKey="retailPrice" stroke="#8884d8" strokeWidth={3} name="Retail Price" />
        <Line yAxisId="price" type="monotone" dataKey="actualPrice" stroke="#82ca9d" strokeWidth={2} name="Actual Cost" />
        <Bar yAxisId="margin" dataKey="margin" fill="#ffc658" fillOpacity={0.6} name="Profit Margin" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default memo(PriceHistoryChart);
