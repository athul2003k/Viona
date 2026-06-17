"use client";
import { type NodeProps, type Node, Position, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { ChatModelDialog, type ChatModelFormValues, type ProviderKey } from "./dialog";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { type NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import Image from "next/image";
import { attachCredentialToNode } from "@/app/(dashboard)/credentials/credentials-actions";

type ChatModelNodeData = {
    provider?: ProviderKey;
    model?: string;
    credentialId?: string | null;
};

type ChatModelNodeType = Node<ChatModelNodeData>;

export const ChatModelNode = memo((props: NodeProps<ChatModelNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes, setEdges } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleDelete = () => {
        setNodes((nodes) => nodes.filter((n) => n.id !== props.id));
        setEdges((edges) => edges.filter((e) => e.source !== props.id && e.target !== props.id));
    };

    const handleSubmit = async (values: ChatModelFormValues, credentialId: string | null) => {
        try {
            await attachCredentialToNode(props.id, credentialId);
        } catch (err) {
            console.error("Failed to attach credential to node", err);
        }

        setNodes((nodes) => {
            return nodes.map((node) => {
                if (node.id === props.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...values,
                            credentialId,
                        },
                    };
                }
                return node;
            });
        });
    };

    const nodeData = props.data;
    const providerIcon = nodeData?.provider === "openai"
        ? "/logos/openai.svg"
        : nodeData?.provider === "anthropic"
            ? "/logos/anthropic.svg"
            : nodeData?.provider === "groq"
                ? "/logos/groq.svg"
                : "/logos/gemini.svg";

    const providerName = nodeData?.provider === "openai"
        ? "OpenAI"
        : nodeData?.provider === "anthropic"
            ? "Anthropic"
            : nodeData?.provider === "groq"
                ? "Groq"
                : "Gemini";

    const description = nodeData?.model
        ? nodeData.model
        : "Not configured";

    return (
        <>
            <ChatModelDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData as Partial<ChatModelFormValues>}
                defaultCredentialId={nodeData?.credentialId ?? null}
            />
            <WorkflowNode
                name={nodeData?.provider ? providerName : "Chat Model"}
                description={description}
                onSettings={handleOpenSettings}
                onDelete={handleDelete}
            >
                <NodeStatusIndicator status={nodeStatus} variant="border" roundedClass="rounded-full">
                    <BaseNode className="rounded-full" status={nodeStatus} onDoubleClick={handleOpenSettings}>
                        <BaseNodeContent>
                            <Image src={providerIcon} alt={providerName} width={16} height={16} />
                            <BaseHandle position={Position.Top} type="source" id="source-1" />
                        </BaseNodeContent>
                    </BaseNode>
                </NodeStatusIndicator>
            </WorkflowNode>
        </>
    );
});

ChatModelNode.displayName = "ChatModelNode";
