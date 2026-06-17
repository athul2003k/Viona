import type { NodeExecutor } from "../types";

// Memory is a config-only sub-node.
// It does NOT execute independently — the AI Agent reads its data.
export const memoryExecutor: NodeExecutor = async ({ context }) => {
    return context;
};
