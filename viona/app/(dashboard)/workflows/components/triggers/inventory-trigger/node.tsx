import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { InventoryTriggerDialog } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { PackageSearch } from "lucide-react";

export const InventoryTriggerNode = memo((props: NodeProps) => {
    const [open, setOpen] = useState(false);

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);
    return (
        <>
            <InventoryTriggerDialog
                open={open}
                onOpenChange={setOpen}
            />
            <BaseTriggerNode
                {...props}
                icon={PackageSearch}
                name="Inventory"
                description="When inventory is updated"
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});
InventoryTriggerNode.displayName = "InventoryTriggerNode";
