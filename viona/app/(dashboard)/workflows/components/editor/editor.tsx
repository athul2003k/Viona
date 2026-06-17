"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    Background,
    MiniMap,
    Controls,
    Panel,
    type NodeChange,
    type EdgeChange,
} from "@xyflow/react";

import '@xyflow/react/dist/style.css';
import { getWorkflowWithNodes } from '../../workflow-actions';
import { nodeComponents } from '@/config/node-components';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AddNodeButton } from './add-node-button';
import { useSetAtom } from 'jotai';
import { editorAtom } from './store/atom';
import { NodeType } from '@prisma/client';
import { ExecuteWorkflowButton } from "../execute-workflow-button";
import { useTheme } from "next-themes";
import { WorkflowIdProvider } from "./workflow-context";

export const EditorLoading = () => {
    return (
        <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
        </div>
    );
};

export const EditorError = () => {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-lg font-semibold">Error Loading Editor</h2>
                <p className="text-muted-foreground text-sm mt-2">
                    Failed to load workflow data
                </p>
            </div>
        </div>
    );
};

export const Editor = ({ workflowId }: { workflowId: string }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    const setEditor = useSetAtom(editorAtom);
    const { resolvedTheme } = useTheme();

    const hasManualTrigger = useMemo(() => {
        return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
    }, [nodes]);

    // Clean up the atom when the editor unmounts
    useEffect(() => {
        return () => {
            setEditor(null);
        };
    }, [setEditor]);

    useEffect(() => {
        async function loadWorkflow() {
            try {
                setIsLoading(true);
                const workflow = await getWorkflowWithNodes(workflowId);

                if (workflow) {
                    setNodes(workflow.nodes);
                    setEdges(workflow.edges);
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Failed to load workflow:", err);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        }

        loadWorkflow();
    }, [workflowId]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
        [],
    );
    const onConnect = useCallback(
        (params: Connection) => {
            const isAgentToolConnection = [
                "chat-model-target",
                "memory-target",
                "tool-target"
            ].includes(params.targetHandle || "");

            const edgeToAdd = isAgentToolConnection
                ? { ...params, animated: true, style: { strokeDasharray: "5,5" } }
                : params;

            setEdges((edgesSnapshot) => addEdge(edgeToAdd, edgesSnapshot));
        },
        [],
    );

    if (isLoading) {
        return <EditorLoading />;
    }

    if (error) {
        return <EditorError />;
    }

    return (
        <WorkflowIdProvider value={workflowId}>
            <div className='size-full'>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                    proOptions={{
                        hideAttribution: true,
                    }}
                    nodeTypes={nodeComponents}
                    onInit={setEditor}
                >
                    <Background />
                    <Controls />
                    <MiniMap
                        nodeColor={resolvedTheme === 'dark' ? '#1c2720ff' : '#4a554cff'}
                        maskColor={resolvedTheme === 'dark' ? 'rgba(16, 44, 24, 1)' : 'rgba(244, 244, 245, 0.6)'}
                    />
                    <Panel position="top-right" >
                        <AddNodeButton />
                    </Panel>
                    {hasManualTrigger && (
                        <Panel position="bottom-center">
                            <ExecuteWorkflowButton workflowId={workflowId} />
                        </Panel>
                    )}
                </ReactFlow>
            </div>
        </WorkflowIdProvider>
    );
};
