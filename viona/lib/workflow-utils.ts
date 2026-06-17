// Topological sort utility (extracted from inngest/utils.ts, no inngest dependency)
import { Connection, Node, NodeType } from "@prisma/client";
import toposort from "toposort";

const TRIGGER_TYPES: string[] = [
    NodeType.MANUAL_TRIGGER,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
    NodeType.INVENTORY_TRIGGER,
    NodeType.ORDER_TRIGGER,
    NodeType.SCHEDULED_TRIGGER,
    NodeType.INITIAL,
];

export const topologicalSort = (nodes: Node[], connections: Connection[]) => {
    // Only follow main-flow connections for execution ordering.
    // Sub-node connections (chat-model, memory, tool) are read by the AI Agent at runtime.
    const mainConnections = connections.filter(
        (c) => !c.toInput || c.toInput === "main" || c.toInput === "target-1"
    );

    // Build an adjacency list from main connections
    const adjacency = new Map<string, string[]>();
    for (const conn of mainConnections) {
        if (!adjacency.has(conn.fromNodeId)) {
            adjacency.set(conn.fromNodeId, []);
        }
        adjacency.get(conn.fromNodeId)!.push(conn.toNodeId);
    }

    // Find trigger nodes
    const triggerNodes = nodes.filter((n) => TRIGGER_TYPES.includes(n.type));

    // BFS to find all nodes reachable from triggers via connections
    const reachable = new Set<string>();
    const queue = triggerNodes.map((n) => n.id);
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);
        const neighbors = adjacency.get(current) || [];
        for (const neighbor of neighbors) {
            if (!reachable.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }

    // Only include reachable nodes
    const reachableNodes = nodes.filter((n) => reachable.has(n.id));

    const reachableEdges: [string, string][] = mainConnections
        .filter((c) => reachable.has(c.fromNodeId) && reachable.has(c.toNodeId))
        .map((c) => [c.fromNodeId, c.toNodeId]);

    if (reachableEdges.length === 0) {
        return reachableNodes;
    }

    let sortedNodeIds: string[];
    try {
        sortedNodeIds = toposort(reachableEdges);
        sortedNodeIds = [...new Set(sortedNodeIds)];
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cyclic")) {
            throw new Error("Workflow contains a cycle");
        }
        throw error;
    }

    const nodeMap = new Map(reachableNodes.map((n) => [n.id, n]));
    return sortedNodeIds.map((id) => nodeMap.get(id)!).filter(Boolean);
};
