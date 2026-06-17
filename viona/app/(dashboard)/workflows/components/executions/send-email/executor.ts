import type { NodeExecutor } from "../types";

export const sendEmailExecutor: NodeExecutor<any> = async ({ context }) => {
    // Pass-through: Send Email is a tool sub-node.
    // Its config is read by the AI Agent executor at runtime.
    return context;
};
