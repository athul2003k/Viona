"use client";

import { memo, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Order = { orderId: string; orderDate: string; quantity: number; priceAtOrder: number };

function OrderTrendChart({ data }: { data: Order[] }) {
  const chartData = useMemo(() => {
    const grouped: Record<string, { month: string; quantity: number; revenue: number }> = {};
    for (const o of data) {
      const month = new Date(o.orderDate).toLocaleDateString("en-US", { year: "numeric", month: "short" });
      if (!grouped[month]) grouped[month] = { month, quantity: 0, revenue: 0 };
      grouped[month].quantity += o.quantity;
      grouped[month].revenue += o.quantity * o.priceAtOrder;
    }
    return Object.values(grouped);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis yAxisId="quantity" />
        <YAxis yAxisId="revenue" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="quantity" dataKey="quantity" fill="#8884d8" name="Quantity Sold" />
        <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#ff7300" strokeWidth={2} name="Revenue ($)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default memo(OrderTrendChart);
