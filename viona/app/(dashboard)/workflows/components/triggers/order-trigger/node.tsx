import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { OrderTriggerDialog } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";
import { ShoppingCart } from "lucide-react";

export const OrderTriggerNode = memo((props: NodeProps) => {
    const [open, setOpen] = useState(false);

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);
    return (
        <>
            <OrderTriggerDialog
                open={open}
                onOpenChange={setOpen}
            />
            <BaseTriggerNode
                {...props}
                icon={ShoppingCart}
                name="Order"
                description="When order is updated"
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});
OrderTriggerNode.displayName = "OrderTriggerNode";
