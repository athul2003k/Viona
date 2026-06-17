import type { NodeExecutor } from "../../executions/types";

type OrderTriggerData = {
    variableName?: string;
};

export const orderTriggerExecutor: NodeExecutor<OrderTriggerData> = async ({ data, nodeId, context, publish }) => {
    await publish(nodeId, "loading");

    // The order event data is injected into context.order by workflow-events.ts
    // We re-expose it under the user's chosen variableName (defaults to "order")
    const variableName = data?.variableName || "order";
    const orderData = (context.order ?? {}) as Record<string, unknown>;

    await publish(nodeId, "success");

    return {
        ...context,
        [variableName]: orderData,
    };
};
