"use client";
import { type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { BaseExecutionNode } from "@/app/(dashboard)/workflows/components/executions/base-execution-node";
import { memo, useState } from "react";
import { SlackDialog, type SlackFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { attachCredentialToNode } from "@/app/(dashboard)/credentials/credentials-actions";

type SlackNodeData = {
    webhookUrl?: string;
    content?: string;
};

type SlackNodeType = Node<SlackNodeData>;

export const SlackNode = memo((props: NodeProps<SlackNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = async (values: SlackFormValues, credentialId: string | null) => {
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
    }

    const nodeData = props.data;
    const description = nodeData?.content
        ? `Send: ${nodeData.content.slice(0, 50)}...`
        : "Not configured";



    return (
        <>
            <SlackDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/slack.svg"
                name="Slack"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );

});

SlackNode.displayName = "SlackNode";
