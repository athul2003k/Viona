"use client";
import "./ai-agent-node.css";
import { type NodeProps, type Node, Position, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { AiAgentDialog, type AiAgentFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { Bot,CheckCircle2, Loader2, XCircle } from "lucide-react";

type AiAgentNodeData = {
    variableName?: string;
    systemPrompt?: string;
    userPrompt?: string;
    maxIterations?: number;
};

type AiAgentNodeType = Node<AiAgentNodeData>;

export const AiAgentNode = memo((props: NodeProps<AiAgentNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes, setEdges } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = (values: AiAgentFormValues) => {
        setNodes((nodes) => {
            return nodes.map((node) => {
                if (node.id === props.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...values,
                        },
                    };
                }
                return node;
            });
        });
    };

    const handleDelete = () => {
        setNodes((currentNodes) => currentNodes.filter((node) => node.id !== props.id));
        setEdges((currentEdges) => currentEdges.filter(
            (edge) => edge.source !== props.id && edge.target !== props.id
        ));
    };

    const nodeData = props.data;
    const description = nodeData?.userPrompt
        ? `${nodeData.userPrompt.slice(0, 40)}...`
        : "Not configured";

    return (
        <>
            <AiAgentDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <WorkflowNode
                name=""
                onDelete={handleDelete}
                onSettings={handleOpenSettings}
            >
                <div
                    className="ai-agent-node group"
                    onDoubleClick={handleOpenSettings}
                    tabIndex={0}
                    data-status={nodeStatus}
                >
                
                    <div className="ai-agent-node__body">
                        <div >
                            <Bot className="size-6 " strokeWidth={1.5} />
                        </div>
                        <div className="ai-agent-node__title-group">
                            <span className="ai-agent-node__title">AI Agent</span>
                            <span className="ai-agent-node__desc">Tools Agent</span>
                        </div>
                   
                        {nodeStatus === "loading" && (
                            <Loader2 className="size-4 text-blue-500 animate-spin absolute top-3 right-3" />
                        )}
                        {nodeStatus === "success" && (
                            <CheckCircle2 className="size-4 text-emerald-500 absolute top-3 right-3" />
                        )}
                        {nodeStatus === "error" && (
                            <XCircle className="size-4 text-red-500 absolute top-3 right-3" />
                        )}
                    </div>

                    
                    <BaseHandle
                        position={Position.Bottom}
                        type="target"
                        id="chat-model-target"
                        className="ai-agent-node__diamond-handle"
                        style={{ left: '25%' }}
                    />
                    <span className="ai-agent-node__handle-label" style={{ left: '20%' }}>Chat Model</span>

                    <BaseHandle
                        position={Position.Bottom}
                        type="target"
                        id="memory-target"
                        className="ai-agent-node__diamond-handle"
                        style={{ left: '50%' }}
                    />
                    <span className="ai-agent-node__handle-label" style={{ left: '50%' }}>Memory</span>

                    <BaseHandle
                        position={Position.Bottom}
                        type="target"
                        id="tool-target"
                        className="ai-agent-node__diamond-handle"
                        style={{ left: '75%' }}
                    />
                    <span className="ai-agent-node__handle-label" style={{ left: '75%' }}>Tool</span>

                    
                    <BaseHandle
                        position={Position.Left}
                        type="target"
                        id="target-1"
                        className="ai-agent-node__left-handle"
                    />
                    <BaseHandle
                        position={Position.Right}
                        type="source"
                        id="source-1"
                        className="ai-agent-node__right-handle"
                    />
                </div>
            </WorkflowNode>
        </>
    );
});

AiAgentNode.displayName = "AiAgentNode";
