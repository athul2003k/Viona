"use client";
import "./conditional-node.css";
import { type NodeProps, type Node, Position, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { ConditionalDialog, type ConditionalFormValues } from "./dialog";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { type NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { Signpost } from "lucide-react";

type ConditionalNodeData = ConditionalFormValues;
type ConditionalNodeType = Node<ConditionalNodeData>;

export const ConditionalNode = memo((props: NodeProps<ConditionalNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes, setEdges } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = (values: ConditionalFormValues) => {
        setNodes((nodes) => {
            return nodes.map((node) => {
                if (node.id === props.id) {
                    return { ...node, data: { ...node.data, ...values } };
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

    return (
        <>
            <ConditionalDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <WorkflowNode
                name="If"
                onDelete={handleDelete}
                onSettings={handleOpenSettings}
                showToolbar={true}
            >
                <NodeStatusIndicator status={nodeStatus} variant="border">
                    <BaseNode status={nodeStatus} onDoubleClick={handleOpenSettings}>
                        <BaseNodeContent>
                            <Signpost className="size-4 text-green-500 fill-green-500/20" strokeWidth={2.5} />

                            {/* Input Handle */}
                            <BaseHandle 
                                position={Position.Left} 
                                type="target" 
                                id="target-1" 
                                className="conditional-node__left-handle" 
                            />

                            {/* True Output Handle */}
                            <BaseHandle 
                                position={Position.Right} 
                                type="source" 
                                id="true-branch"
                                className="conditional-node__right-handle" 
                                style={{ top: '30%' }}
                            />
                            <span className="conditional-node__right-label" style={{ top: '30%' }}>true</span>

                            {/* False Output Handle */}
                            <BaseHandle 
                                position={Position.Right} 
                                type="source" 
                                id="false-branch"
                                className="conditional-node__right-handle" 
                                style={{ top: '70%' }}
                            />
                            <span className="conditional-node__right-label" style={{ top: '70%' }}>false</span>
                        </BaseNodeContent>
                    </BaseNode>
                </NodeStatusIndicator>
            </WorkflowNode>
        </>
    );
});

ConditionalNode.displayName = "ConditionalNode";
