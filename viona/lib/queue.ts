// BullMQ workflow execution queue
import { Queue } from "bullmq";

// ---------- Connection config ----------
const connection = {
    host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
    port: Number(new URL(process.env.REDIS_URL || "redis://localhost:6379").port) || 6379,
};

const isBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.CI;

// ---------- Queue ----------
export const workflowQueue = isBuild
    ? ({} as Queue)
    : new Queue("workflow-execution", { connection });

// ---------- Job type ----------
export interface WorkflowJobData {
    workflowId: string;
    initialData?: Record<string, unknown>;
}

// ---------- Helper: enqueue a workflow ----------
export async function enqueueWorkflow(data: WorkflowJobData) {
    await workflowQueue.add("execute", data, {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
    });
}
