"use client";

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// Chart colors
const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

// Fallback colors if CSS vars not available
const FALLBACK_COLORS = [
    "#22c55e", // green
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
];

interface ChartBlockData {
    chart_type: "line" | "bar" | "pie" | "area";
    title: string;
    x: string[];
    y: number[];
    x_label?: string;
    y_label?: string;
}

interface VionaChartProps {
    data: ChartBlockData;
    className?: string;
}

export function VionaChart({ data, className }: VionaChartProps) {
    // Transform x/y arrays into recharts data format
    const chartData = data.x.map((label, i) => ({
        name: label,
        value: data.y[i] || 0,
    }));

    const renderChart = () => {
        switch (data.chart_type) {
            case "line":
                return (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={FALLBACK_COLORS[0]}
                            strokeWidth={2}
                            dot={{ fill: FALLBACK_COLORS[0], strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                );

            case "bar":
                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartData.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                );

            case "pie":
                return (
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) =>
                                `${name} (${(percent * 100).toFixed(0)}%)`
                            }
                            labelLine={false}
                        >
                            {chartData.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        <Legend />
                    </PieChart>
                );

            case "area":
                return (
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ className: "stroke-muted" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={FALLBACK_COLORS[0]}
                            fill={FALLBACK_COLORS[0]}
                            fillOpacity={0.3}
                        />
                    </AreaChart>
                );

            default:
                return (
                    <BarChart data={chartData}>
                        <Bar dataKey="value" fill={FALLBACK_COLORS[0]} />
                    </BarChart>
                );
        }
    };

    return (
        <div className={cn("w-full", className)}>
            {data.title && (
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {data.title}
                </h4>
            )}
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
