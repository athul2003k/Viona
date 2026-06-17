import type { NodeExecutor } from "../../executions/types";

type GoogleFormTriggerData = Record<string, unknown>;

export const googleFormTriggerExecutor: NodeExecutor<GoogleFormTriggerData> = async ({ nodeId, context, publish }) => {
    await publish(nodeId, "loading");
    await publish(nodeId, "success");
    return context;
};