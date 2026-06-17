import type { NodeExecutor } from "../../executions/types";

type InventoryTriggerData = {
    variableName?: string;
};

export const inventoryTriggerExecutor: NodeExecutor<InventoryTriggerData> = async ({ data, nodeId, context, publish }) => {
    await publish(nodeId, "loading");

    // The inventory event data is injected into context.inventory by workflow-events.ts
    // We re-expose it under the user's chosen variableName (defaults to "inventory")
    const variableName = data?.variableName || "inventory";
    const inventoryData = (context.inventory ?? {}) as Record<string, unknown>;

    await publish(nodeId, "success");

    return {
        ...context,
        [variableName]: inventoryData,
    };
};
