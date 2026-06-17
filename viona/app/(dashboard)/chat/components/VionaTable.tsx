"use client";

import { cn } from "@/lib/utils";

interface TableData {
    title?: string;
    columns: string[];
    rows: (string | number)[][];
}

interface VionaTableProps {
    data: TableData;
    className?: string;
}

export function VionaTable({ data, className }: VionaTableProps) {
    return (
        <div className={cn("w-full", className)}>
            {data.title && (
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {data.title}
                </h4>
            )}
            <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50">
                            {data.columns.map((col, i) => (
                                <th
                                    key={i}
                                    className="text-left py-2 px-3 font-medium text-muted-foreground whitespace-nowrap"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className="border-b border-border/30 last:border-0"
                            >
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className={cn(
                                            "py-2 px-3 whitespace-nowrap",
                                            typeof cell === "string" && cell.includes("⚠️") && "text-amber-600 dark:text-amber-400",
                                            typeof cell === "string" && cell.includes("✅") && "text-green-600 dark:text-green-400",
                                        )}
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {data.rows.length > 10 && (
                <div className="text-xs text-muted-foreground mt-2">
                    Showing {data.rows.length} rows
                </div>
            )}
        </div>
    );
}
