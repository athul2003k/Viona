// Cron scheduler for scheduled workflows
// Replaces inngest/scheduled-workflows.ts
import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { NodeType } from "@prisma/client";
import { enqueueWorkflow } from "./queue";

let started = false;

export function startCronScheduler() {
    if (started) return;
    started = true;

    // Run every minute, same as the old Inngest cron
    cron.schedule("* * * * *", async () => {
        try {
            const nodes = await prisma.node.findMany({
                where: { type: NodeType.SCHEDULED_TRIGGER },
                include: { workflow: { select: { id: true, status: true } } },
            });

            const now = new Date();

            for (const node of nodes) {
                if (node.workflow.status === "deleted") continue;

                const data = node.data as any;
                const cronExpr = data?.cronExpression;
                if (!cronExpr) continue;

                if (cronMatchesNow(cronExpr, now)) {
                    await enqueueWorkflow({
                        workflowId: node.workflow.id,
                        initialData: {
                            schedule: {
                                triggeredAt: new Date().toISOString(),
                                cronExpression: cronExpr,
                            },
                        },
                    });
                    console.log(`⏰ Triggered scheduled workflow ${node.workflow.id}`);
                }
            }
        } catch (error) {
            console.error("Cron scheduler error:", error);
        }
    });

    console.log("⏰ Cron scheduler started (every minute)");
}

// ─── Cron matching helpers (same logic as before) ───

function cronMatchesNow(expression: string, now: Date): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return false;

    const fields = [
        now.getMinutes(),
        now.getHours(),
        now.getDate(),
        now.getMonth() + 1,
        now.getDay(),
    ];

    for (let i = 0; i < 5; i++) {
        if (!fieldMatches(parts[i], fields[i])) return false;
    }
    return true;
}

function fieldMatches(pattern: string, value: number): boolean {
    const alternatives = pattern.split(",");
    return alternatives.some((alt) => singleFieldMatches(alt.trim(), value));
}

function singleFieldMatches(pattern: string, value: number): boolean {
    if (pattern === "*") return true;

    if (pattern.includes("/")) {
        const [rangePart, stepStr] = pattern.split("/");
        const stepVal = parseInt(stepStr, 10);
        if (isNaN(stepVal) || stepVal <= 0) return false;

        if (rangePart === "*") {
            return value % stepVal === 0;
        }
        if (rangePart.includes("-")) {
            const [startStr, endStr] = rangePart.split("-");
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            return value >= start && value <= end && (value - start) % stepVal === 0;
        }
        return false;
    }

    if (pattern.includes("-")) {
        const [startStr, endStr] = pattern.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        return value >= start && value <= end;
    }

    return parseInt(pattern, 10) === value;
}
