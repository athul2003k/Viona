import type { NodeExecutor } from "../../executions/types";

type ManualTriggerData = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async ({ nodeId, context, publish }) => {
    await publish(nodeId, "loading");
    await publish(nodeId, "success");
    return context;
};