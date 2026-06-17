"use client";

import { useState, useEffect } from "react";
import type { NodeStatus } from "@/components/react-flow/node-status-indicator";
import { useWorkflowId } from "@/app/(dashboard)/workflows/components/editor/workflow-context";

interface UseNodeStatusOptions {
    nodeId: string;
};

// Global shared SSE connection per workflowId
const sseConnections = new Map<string, {
    listeners: Map<string, Set<(status: NodeStatus) => void>>;
    eventSource: EventSource | null;
}>();

function getOrCreateConnection(workflowId: string) {
    if (!workflowId) return null;

    let connection = sseConnections.get(workflowId);
    if (connection) return connection;

    connection = {
        listeners: new Map(),
        eventSource: null,
    };

    const es = new EventSource(`/api/workflow/status?workflowId=${workflowId}`);

    es.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.nodeId && data.status) {
                const nodeListeners = connection!.listeners.get(data.nodeId);
                if (nodeListeners) {
                    nodeListeners.forEach((cb) => cb(data.status as NodeStatus));
                }
            }
        } catch {
            // Ignore parse errors (e.g., connection keepalive)
        }
    };

    es.onerror = () => {
        // EventSource auto-reconnects
    };

    connection.eventSource = es;
    sseConnections.set(workflowId, connection);

    return connection;
}

export function useNodeStatus({ nodeId }: UseNodeStatusOptions) {
    const workflowId = useWorkflowId();
    const [status, setStatus] = useState<NodeStatus>("initial");

    useEffect(() => {
        if (!workflowId || !nodeId) return;

        const connection = getOrCreateConnection(workflowId);
        if (!connection) return;

        if (!connection.listeners.has(nodeId)) {
            connection.listeners.set(nodeId, new Set());
        }
        connection.listeners.get(nodeId)!.add(setStatus);

        return () => {
            connection.listeners.get(nodeId)?.delete(setStatus);
            if (connection.listeners.get(nodeId)?.size === 0) {
                connection.listeners.delete(nodeId);
            }
        };
    }, [workflowId, nodeId]);

    return status;
}