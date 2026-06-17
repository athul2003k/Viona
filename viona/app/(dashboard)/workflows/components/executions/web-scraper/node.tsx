"use client";
import { type NodeProps, type Node, Position, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { WebScraperDialog, type WebScraperFormValues } from "./dialog";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { type NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { Globe } from "lucide-react";

type WebScraperNodeType = Node<Partial<WebScraperFormValues>>;

export const WebScraperNode = memo((props: NodeProps<WebScraperNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes, setEdges } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleDelete = () => {
        setNodes((nodes) => nodes.filter((n) => n.id !== props.id));
        setEdges((edges) => edges.filter((e) => e.source !== props.id && e.target !== props.id));
    };

    const handleSubmit = (values: WebScraperFormValues) => {
        setNodes((nodes) => nodes.map((node) =>
            node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
        ));
    };

    const description = `Max ${props.data?.maxLength || 5000} chars`;

    return (
        <>
            <WebScraperDialog open={open} onOpenChange={setOpen} onSubmit={handleSubmit} defaultValues={props.data} />
            <WorkflowNode name="Web Scraper" description={description} onSettings={() => setOpen(true)} onDelete={handleDelete}>
                <NodeStatusIndicator status={nodeStatus} variant="border" roundedClass="rounded-full">
                    <BaseNode className="rounded-full" status={nodeStatus} onDoubleClick={() => setOpen(true)}>
                        <BaseNodeContent>
                            <Globe className="size-4 text-muted-foreground" />
                            <BaseHandle position={Position.Top} type="source" id="source-1" />
                        </BaseNodeContent>
                    </BaseNode>
                </NodeStatusIndicator>
            </WorkflowNode>
        </>
    );
});
WebScraperNode.displayName = "WebScraperNode";
