import { NodeProps  } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { GoogleFormTriggerDialog } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";

export const GoogleFormTrigger = memo((props: NodeProps) => {
    const [open, setOpen] = useState(false);
    
     const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);
    return (
        <>
        <GoogleFormTriggerDialog 
            open={open} 
            onOpenChange={setOpen} 
            />
           <BaseTriggerNode
               {...props} 
               icon="/logos/googleform.svg" 
               name="Google Form"
               description="When form is submitted" 
               status={nodeStatus}
               onSettings={handleOpenSettings}
               onDoubleClick={handleOpenSettings}
            />
        </>
    )
});