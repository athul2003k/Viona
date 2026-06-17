import type { NodeExecutor } from "../types";

export const orderManagerExecutor: NodeExecutor<any> = async ({ context }) => {
    return context;
};
