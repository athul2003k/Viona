import type { NodeExecutor } from "../types";

// Helper to access nested objects via dot notation string (e.g. "webhook.data.id")
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part) => {
        if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

export const conditionalExecutor: NodeExecutor<{
    variableName?: string;
    operator?: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains";
    value?: string;
}> = async ({ data, context, publish, nodeId }) => {
    try {
        await publish(nodeId, "loading");

        if (!data?.variableName || !data?.operator || data?.value === undefined) {
            throw new Error("Conditional node is missing required configuration.");
        }

        const rawTargetValue = getNestedValue(context, data.variableName);
        
        let targetValue: any = rawTargetValue;
        let compareValue: any = data.value;

        // Auto numeric conversion for inequalities
        if (["<", ">", "<=", ">="].includes(data.operator)) {
            const numTarget = Number(targetValue);
            const numCompare = Number(compareValue);
            if (!isNaN(numTarget) && !isNaN(numCompare)) {
                targetValue = numTarget;
                compareValue = numCompare;
            }
        }

        let result = false;

        switch (data.operator) {
            case "==":
                // eslint-disable-next-line eqeqeq
                result = String(targetValue) == String(compareValue);
                break;
            case "!=":
                // eslint-disable-next-line eqeqeq
                result = String(targetValue) != String(compareValue);
                break;
            case ">":
                result = targetValue > compareValue;
                break;
            case "<":
                result = targetValue < compareValue;
                break;
            case ">=":
                result = targetValue >= compareValue;
                break;
            case "<=":
                result = targetValue <= compareValue;
                break;
            case "contains":
                result = String(targetValue).includes(String(compareValue));
                break;
            case "not_contains":
                result = !String(targetValue).includes(String(compareValue));
                break;
            default:
                throw new Error(`Unsupported operator: ${data.operator}`);
        }

        await publish(nodeId, "success");
        
        // Return context enhanced with our active output route path
        return {
            ...context,
            // Prefix to avoid conflicts, used by worker branching logic
            _activeOutputHandle: result ? "true-branch" : "false-branch" 
        };
    } catch (error) {
        console.error("Conditional Evaluation Error:", error);
        await publish(nodeId, "error");
        throw error;
    }
};
