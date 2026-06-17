import type { NodeExecutor } from "../types";

export const webScraperExecutor: NodeExecutor<any> = async ({ context }) => {
    return context;
};
