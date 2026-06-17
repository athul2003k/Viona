"use client";

import { type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { ScheduledTriggerDialog, type ScheduledTriggerFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { Clock } from "lucide-react";

type ScheduledTriggerNodeType = Node<Partial<ScheduledTriggerFormValues>>;

export const ScheduledTriggerNode = memo((props: NodeProps<ScheduledTriggerNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleSubmit = (values: ScheduledTriggerFormValues) => {
        setNodes((nodes) => nodes.map((node) =>
            node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
        ));
    };

    const handleOpenSettings = () => setOpen(true);

    // Build a user-friendly description from the cron expression
    const cron = props.data?.cronExpression;
    let description = "Not configured";
    if (cron) {
        const p = cron.trim().split(/\s+/);
        if (p.length >= 5) {
            const [min, hr, dom, , dow] = p;
            if (min === "*" && hr === "*") description = "Every minute";
            else if (min.startsWith("*/") && hr === "*") description = `Every ${min.slice(2)} min`;
            else if (min === "0" && hr === "*") description = "Every hour";
            else if (dow !== "*" && dom === "*") description = "Weekly";
            else if (dom !== "*") description = "Monthly";
            else description = "Daily";
        }
    }

    return (
        <>
            <ScheduledTriggerDialog
                open={open}
                onOpenChange={setOpen}
                onSubmit={handleSubmit}
                defaultValues={props.data}
            />
            <BaseTriggerNode
                {...props}
                icon={Clock}
                name="Schedule"
                description={description}
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});
ScheduledTriggerNode.displayName = "ScheduledTriggerNode";
