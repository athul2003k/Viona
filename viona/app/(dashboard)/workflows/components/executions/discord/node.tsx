"use client";
import { type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { BaseExecutionNode } from "@/app/(dashboard)/workflows/components/executions/base-execution-node";
import { memo, useState } from "react";
import { DiscordDialog, type DiscordFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { attachCredentialToNode } from "@/app/(dashboard)/credentials/credentials-actions";

type DiscordNodeData = {
    webhookUrl?: string;
    content?: string;
    username?: string;
};

type DiscordNodeType = Node<DiscordNodeData>;

export const DiscordNode = memo((props: NodeProps<DiscordNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = async (values: DiscordFormValues, credentialId: string | null) => {
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
            <DiscordDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/discord.svg"
                name="Discord"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );

});

DiscordNode.displayName = "DiscordNode";
