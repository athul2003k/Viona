import type { NodeExecutor } from "../../executions/types";

type ScheduledTriggerData = Record<string, unknown>;

export const scheduledTriggerExecutor: NodeExecutor<ScheduledTriggerData> = async ({ nodeId, context, publish }) => {
    await publish(nodeId, "loading");
    await publish(nodeId, "success");
    return context;
};
