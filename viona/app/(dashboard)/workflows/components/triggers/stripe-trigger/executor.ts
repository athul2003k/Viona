import type { NodeExecutor } from "../../executions/types";

type StripeTriggerData = Record<string, unknown>;

export const stripeTriggerExecutor: NodeExecutor<StripeTriggerData> = async ({ nodeId, context, publish }) => {
    await publish(nodeId, "loading");
    await publish(nodeId, "success");
    return context;
};