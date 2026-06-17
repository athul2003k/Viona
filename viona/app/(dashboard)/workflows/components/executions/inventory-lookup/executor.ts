import type { NodeExecutor } from "../types";

export const inventoryLookupExecutor: NodeExecutor<any> = async ({ context }) => {
    return context;
};
