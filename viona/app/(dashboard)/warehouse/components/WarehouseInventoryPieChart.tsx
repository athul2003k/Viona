"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from "recharts";
import { Package } from "lucide-react";
import { useState } from "react";

type ProductStock = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  imageUrl?: string;
};

type Props = {
  products: ProductStock[];
};

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c7c",
  "#a28ef5",
  "#66d9ef",
];

// Active shape component for hover effect
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill="#333"
        className="text-sm font-semibold dark:fill-white"
      >
        {value.toLocaleString()} units
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#999"
        className="text-xs"
      >
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

export function WarehouseInventoryPieChart({ products }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stock Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Stock Data</h3>
              <p className="text-muted-foreground">
                Add products to see stock distribution.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for pie chart - take top 10 products by quantity
  const sortedProducts = [...products]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const chartData = sortedProducts.map((product) => ({
    name: product.productName.length > 25 
      ? `${product.productName.substring(0, 25)}...` 
      : product.productName,
    fullName: product.productName,
    value: product.quantity,
    sku: product.sku,
  }));

  // Calculate if there are more products
  const remainingProducts = products.length - sortedProducts.length;
  const remainingQuantity = products
    .slice(10)
    .reduce((sum, p) => sum + p.quantity, 0);

  if (remainingProducts > 0) {
    chartData.push({
      name: `Other (${remainingProducts})`,
      fullName: `${remainingProducts} other products`,
      value: remainingQuantity,
      sku: "N/A",
    });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
          <p className="font-semibold text-sm">{data.fullName}</p>
          <p className="text-xs text-muted-foreground">SKU: {data.sku}</p>
          <p className="text-sm mt-1">
            Quantity: <span className="font-bold">{data.value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Stock Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">
          Top {Math.min(products.length, 10)} products by quantity (hover to view details)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={140}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="transition-all duration-300 hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend with animation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {chartData.map((item, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 cursor-pointer ${
                activeIndex === index
                  ? "bg-primary/10 border-primary scale-105"
                  : "bg-muted/50 border-transparent hover:bg-muted"
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 transition-transform duration-300"
                style={{ 
                  backgroundColor: COLORS[index % COLORS.length],
                  transform: activeIndex === index ? "scale(1.2)" : "scale(1)",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.value.toLocaleString()} units
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {((item.value / chartData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
