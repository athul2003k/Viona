"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { VionaChart } from "./VionaChart";
import { VionaTable } from "./VionaTable";

// Types matching backend AgentOutput
interface ChartBlock {
    chart_type: "line" | "bar" | "pie" | "area";
    title: string;
    x: string[];
    y: number[];
    x_label?: string;
    y_label?: string;
}

interface TableData {
    title?: string;
    columns: string[];
    rows: (string | number)[][];
}

interface AnalyticsSection {
    overview: string;
    key_metrics: Array<{ name: string; value: string | number; change?: string }>;
    detailed_breakdown?: TableData;
    charts: ChartBlock[];
    observations: string[];
    follow_ups: string[];
}

interface AgentOutput {
    type: "text" | "chart" | "table" | "action";
    payload: Record<string, unknown>;
    summary: string;
    confidence: number;
    suggestions?: string[];
}

interface AgentResponseRendererProps {
    output: AgentOutput;
    className?: string;
}

// Parse markdown tables from content
function parseMarkdownTables(content: string): { text: string; tables: TableData[] } {
    const tables: TableData[] = [];
    const lines = content.split("\n");
    const cleanedLines: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
            if (i + 1 < lines.length && lines[i + 1].match(/^\|[\s-:|]+\|$/)) {
                let title = "";
                if (cleanedLines.length > 0) {
                    const lastLine = cleanedLines[cleanedLines.length - 1];
                    if (lastLine.match(/^(📋|📊|📈)?\s*\*?\*?[\w\s]+\*?\*?$/)) {
                        title = lastLine.replace(/\*\*/g, "").replace(/📋|📊|📈/g, "").trim();
                        cleanedLines.pop();
                    }
                }

                const columns = line.split("|").filter(c => c.trim()).map(c => c.trim());
                i += 2;

                const rows: (string | number)[][] = [];
                while (i < lines.length && lines[i].trim().startsWith("|")) {
                    const rowCells = lines[i].split("|").filter(c => c.trim() !== "").map(c => c.trim());
                    if (rowCells.length > 0) {
                        rows.push(rowCells);
                    }
                    i++;
                }

                if (columns.length > 0 && rows.length > 0) {
                    tables.push({ title: title || undefined, columns, rows });
                }
                continue;
            }
        }

        cleanedLines.push(line);
        i++;
    }

    return { text: cleanedLines.join("\n").trim(), tables };
}

// Parse chart blocks from content
function parseChartBlocks(content: string): { text: string; charts: ChartBlock[] } {
    const charts: ChartBlock[] = [];
    const chartRegex = /```chart\s*\n([\s\S]*?)```/g;

    let match;
    let cleanedText = content;

    while ((match = chartRegex.exec(content)) !== null) {
        const chartContent = match[1];

        const typeMatch = chartContent.match(/type:\s*(\w+)/);
        const titleMatch = chartContent.match(/title:\s*(.+)/);
        const xMatch = chartContent.match(/x:\s*\[(.*?)\]/);
        const yMatch = chartContent.match(/y:\s*\[(.*?)\]/);

        if (typeMatch && titleMatch && xMatch && yMatch) {
            charts.push({
                chart_type: typeMatch[1] as ChartBlock["chart_type"],
                title: titleMatch[1].trim(),
                x: xMatch[1].split(",").map(s => s.trim().replace(/['"]/g, "")),
                y: yMatch[1].split(",").map(s => parseFloat(s.trim())),
            });
        }

        cleanedText = cleanedText.replace(match[0], "");
    }

    return { text: cleanedText.trim(), charts };
}

// Clean minimal markdown renderer
function MarkdownContent({ content }: { content: string }) {
    const lines = content.split("\n");

    return (
        <div className="space-y-3 leading-relaxed">
            {lines.map((line, i) => {
                // Skip separator lines
                if (line.match(/^\|[\s-:|]+\|$/)) return null;

                // Headers with emojis
                if (line.match(/^(📌|📊|📋|📈|🧠|💡)\s*\*\*(.+)\*\*/)) {
                    return (
                        <h3 key={i} className="text-base font-semibold mt-5 mb-2">
                            {line.replace(/\*\*/g, "")}
                        </h3>
                    );
                }

                // Bullet points
                if (line.startsWith("- ") || line.startsWith("• ")) {
                    const text = line.replace(/^[-•]\s*/, "");
                    return (
                        <div key={i} className="flex gap-2 items-start pl-1">
                            <span className="text-muted-foreground mt-1.5 text-[8px]">●</span>
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                }}
                            />
                        </div>
                    );
                }

                // Numbered lists
                if (line.match(/^\d+\.\s/)) {
                    const text = line.replace(/^\d+\.\s*/, "");
                    const num = line.match(/^(\d+)\./)?.[1];
                    return (
                        <div key={i} className="flex gap-3 items-start pl-1">
                            <span className="text-muted-foreground font-medium text-sm min-w-[1.2rem]">{num}.</span>
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                }}
                            />
                        </div>
                    );
                }

                // Bold text
                if (line.includes("**")) {
                    return (
                        <p
                            key={i}
                            dangerouslySetInnerHTML={{
                                __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            }}
                        />
                    );
                }

                // Empty lines
                if (line.trim() === "") {
                    return <div key={i} className="h-2" />;
                }

                return <p key={i}>{line}</p>;
            })}
        </div>
    );
}

export function AgentResponseRenderer({ output, className }: AgentResponseRendererProps) {
    const analyticsData = output.payload?.analytics as AnalyticsSection | undefined;

    const { text: textWithoutCharts, charts: parsedCharts } = useMemo(() =>
        parseChartBlocks(output.summary),
        [output.summary]
    );

    const { text: cleanedText, tables: parsedTables } = useMemo(() =>
        parseMarkdownTables(textWithoutCharts),
        [textWithoutCharts]
    );

    const allCharts = useMemo(() => {
        const charts: ChartBlock[] = [];

        // Check if we have structured chart data from analytics
        const hasStructuredChartData = analyticsData?.charts && analyticsData.charts.length > 0;

        if (hasStructuredChartData) {
            charts.push(...analyticsData.charts);
        }

        // Only add parsed charts from markdown if no structured data exists
        // This prevents duplicate rendering when backend sends same data in both formats
        if (!hasStructuredChartData) {
            charts.push(...parsedCharts);
        }

        return charts;
    }, [analyticsData?.charts, parsedCharts]);

    const allTables = useMemo(() => {
        const tables: TableData[] = [];

        // Check if we have structured table data from the payload
        const hasStructuredTableData = analyticsData?.detailed_breakdown ||
            (output.type === "table" && output.payload?.columns && output.payload?.rows);

        if (analyticsData?.detailed_breakdown) {
            tables.push(analyticsData.detailed_breakdown);
        }
        if (output.type === "table" && output.payload?.columns && output.payload?.rows) {
            tables.push(output.payload as unknown as TableData);
        }

        // Only add parsed tables from markdown if no structured data exists
        // This prevents duplicate rendering when backend sends same data in both formats
        if (!hasStructuredTableData) {
            tables.push(...parsedTables);
        }

        return tables;
    }, [analyticsData?.detailed_breakdown, output.type, output.payload, parsedTables]);

    return (
        <div className={cn("space-y-5", className)}>
            {/* Main content */}
            <MarkdownContent content={cleanedText} />

            {/* Tables */}
            {allTables.map((table, i) => (
                <VionaTable key={i} data={table} className="my-4" />
            ))}

            {/* Charts */}
            {allCharts.map((chart, i) => (
                <VionaChart key={i} data={chart} className="my-4" />
            ))}
        </div>
    );
}
