import type { NodeExecutor } from "../types";

export const chatModelExecutor: NodeExecutor = async ({ context }) => {
    return context;
};
