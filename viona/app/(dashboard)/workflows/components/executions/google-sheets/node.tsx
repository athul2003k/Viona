"use client";
import { type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { BaseExecutionNode } from "@/app/(dashboard)/workflows/components/executions/base-execution-node";
import { memo, useState } from "react";
import { GoogleSheetsDialog, type GoogleSheetsFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { attachCredentialToNode } from "@/app/(dashboard)/credentials/credentials-actions";

type GoogleSheetsNodeData = {
    variableName?: string;
    action?: "read" | "append";
    spreadsheetId?: string;
    sheetName?: string;
    range?: string;
    values?: string;
    credentialId?: string | null;
};

type GoogleSheetsNodeType = Node<GoogleSheetsNodeData>;

export const GoogleSheetsNode = memo((props: NodeProps<GoogleSheetsNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = async (values: GoogleSheetsFormValues, credentialId: string | null) => {
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
    const description = nodeData?.spreadsheetId
        ? `${nodeData.action === "append" ? "Append to" : "Read"} ${nodeData.sheetName || "Sheet"}`
        : "Not configured";

    return (
        <>
            <GoogleSheetsDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
                defaultCredentialId={nodeData?.credentialId ?? null}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/googlesheets.svg"
                name="Google Sheets"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );

});

GoogleSheetsNode.displayName = "GoogleSheetsNode";
