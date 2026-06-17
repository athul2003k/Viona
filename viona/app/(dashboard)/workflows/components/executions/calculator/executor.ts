import type { NodeExecutor } from "../types";

export const calculatorExecutor: NodeExecutor<any> = async ({ context }) => {
    return context;
};
