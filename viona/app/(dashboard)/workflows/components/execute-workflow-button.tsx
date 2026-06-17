"use client";

import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2 } from "lucide-react";
import { executeWorkflow } from "@/app/(dashboard)/workflows/workflow-actions";
import { toast } from "sonner";
import { useState } from "react";

export const ExecuteWorkflowButton = ({ workflowId }: {
    workflowId: string;
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleExecute = async () => {
        try {
            setIsLoading(true);
            await executeWorkflow(workflowId);
            toast.success("Workflow execution started", { id: "workflow-execution" });
        } catch (error) {
            toast.error("Failed to execute workflow", { id: "workflow-execution" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            size="lg"
            onClick={handleExecute}
            disabled={isLoading}
        >
            {isLoading ? <Loader2 className="animate-spin size-4 mr-2" /> : <FlaskConical className="size-4 mr-2" />}
            {isLoading ? "Executing..." : "Execute Workflow"}
        </Button>
    );
};