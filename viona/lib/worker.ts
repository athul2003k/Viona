import { Worker, type Job } from "bullmq";
import { NodeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { topologicalSort } from "./workflow-utils";
import { getExecutor } from "@/app/(dashboard)/workflows/components/executions/lib/executor-registry";
import { broadcastStatus } from "./status-broadcaster";
import type { WorkflowJobData } from "./queue";

// ---------- Connection config ----------
const connection = {
    host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
    port: Number(new URL(process.env.REDIS_URL || "redis://localhost:6379").port) || 6379,
};

// ---------- Worker ----------
let workerInstance: Worker | null = null;

export function startWorker() {
    if (workerInstance) return workerInstance;

    workerInstance = new Worker<WorkflowJobData>(
        "workflow-execution",
        async (job: Job<WorkflowJobData>) => {
            const { workflowId, initialData } = job.data;

            // 1. Load & sort workflow nodes
            const workflow = await prisma.workflow.findUniqueOrThrow({
                where: { id: workflowId },
                include: { nodes: true, connections: true },
            });
            const sortedNodes = topologicalSort(workflow.nodes, workflow.connections);

            // 2. Build a publish function scoped to this workflow
            const publish = async (nodeId: string, status: "loading" | "success" | "error") => {
                await broadcastStatus(workflowId, nodeId, status);
            };

            // 3. Execute nodes in order honoring dynamic branches
            let context: Record<string, unknown> = initialData || {};
            const skippedNodes = new Set<string>();

            // Find all connections to evaluate paths
            const { connections } = workflow;

            for (const node of sortedNodes) {
                // If this node is skipped (because its parent was conditionally evaluated false), skip it
                if (skippedNodes.has(node.id)) {
                    // Also mark all its children as skipped too (cascading)
                    const dependentEdges = connections.filter(c => c.fromNodeId === node.id);
                    dependentEdges.forEach(e => skippedNodes.add(e.toNodeId));
                    continue;
                }

                const executor = getExecutor(node.type as NodeType);
                context = await executor({
                    data: node.data as Record<string, unknown>,
                    nodeId: node.id,
                    context,
                    publish,
                });

                // Check if this node returned branching logic (e.g. Conditional Node)
                if (context._activeOutputHandle) {
                    const activeHandle = context._activeOutputHandle as string;
                    // Find any connections coming FROM this node that do NOT match the active handle
                    const inactiveEdges = connections.filter(
                        c => c.fromNodeId === node.id && c.fromOutput !== activeHandle
                    );
                    
                    // Mark the targets of those inactive branches to be skipped
                    inactiveEdges.forEach(e => skippedNodes.add(e.toNodeId));
                    
                    // Cleanup internal flag so it doesn't pollute downstream Context
                    delete context._activeOutputHandle;
                }
            }

            return { workflowId, result: context };
        },
        { connection, concurrency: 5 },
    );

    workerInstance.on("completed", (job) => {
        console.log(`✅ Workflow ${job.data.workflowId} completed`);
    });

    workerInstance.on("failed", (job, err) => {
        console.error(`❌ Workflow ${job?.data.workflowId} failed:`, err.message);
    });

    return workerInstance;
}
