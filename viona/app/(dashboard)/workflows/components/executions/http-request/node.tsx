"use client";
import { type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { GlobeIcon } from "lucide-react";
import { BaseExecutionNode } from "@/app/(dashboard)/workflows/components/executions/base-execution-node";
import { memo, useState } from "react";
import { HttpRequestDialog, type HttpRequestFormValues } from "./dialog";
import { useNodeStatus } from "@/app/(dashboard)/workflows/components/executions/hooks/use-node-status";

type HttpRequestNodeData =  {
    variableName?: string;
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" ;
    body?: string; 
};

type HttpRequestNodeType = Node<HttpRequestNodeData>;

export const HttpRequestNode = memo((props: NodeProps<HttpRequestNodeType>) => {
    const [open, setOpen] = useState(false);
    const { setNodes  } = useReactFlow();

    const nodeStatus = useNodeStatus({ nodeId: props.id });

    const handleOpenSettings = () => setOpen(true);

    const handleSubmit = (values: HttpRequestFormValues) => {
        setNodes((nodes) => {
            return nodes.map((node) => {
                if (node.id === props.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...values,
                        },
                    };
                }
                return node;
            });
        });
    }

    const nodeData = props.data;
    const description = nodeData?.endpoint
       ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
       : "Not configured";

       

       return (
           <>
               <HttpRequestDialog 
                   open={open} 
                   onOpenChange={setOpen} 
                   onSubmit={handleSubmit}
                   defaultValues={nodeData}
               />
                 <BaseExecutionNode
                    {...props}
                    id={props.id}
                    icon={GlobeIcon}
                    name="HTTP Request"
                    status={nodeStatus}
                    description={description}
                    onSettings={handleOpenSettings}
                    onDoubleClick={handleOpenSettings}

                />
            </>
       );

});

HttpRequestNode.displayName = "HttpRequestNode";
