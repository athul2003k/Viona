"use client";
import { type NodeProps, type Node, Position, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { OrderManagerDialog } from "./dialog";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { type NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { ShoppingCart } from "lucide-react";

export const OrderManagerNode = memo((props: NodeProps<Node>) => {
    const [open, setOpen] = useState(false);
    const { setNodes, setEdges } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleDelete = () => {
        setNodes((nodes) => nodes.filter((n) => n.id !== props.id));
        setEdges((edges) => edges.filter((e) => e.source !== props.id && e.target !== props.id));
    };

    return (
        <>
            <OrderManagerDialog open={open} onOpenChange={setOpen} />
            <WorkflowNode name="Orders" description="Auto-configured" onSettings={() => setOpen(true)} onDelete={handleDelete}>
                <NodeStatusIndicator status={nodeStatus} variant="border" roundedClass="rounded-full">
                    <BaseNode className="rounded-full" status={nodeStatus} onDoubleClick={() => setOpen(true)}>
                        <BaseNodeContent>
                            <ShoppingCart className="size-4 text-muted-foreground" />
                            <BaseHandle position={Position.Top} type="source" id="source-1" />
                        </BaseNodeContent>
                    </BaseNode>
                </NodeStatusIndicator>
            </WorkflowNode>
        </>
    );
});
OrderManagerNode.displayName = "OrderManagerNode";
