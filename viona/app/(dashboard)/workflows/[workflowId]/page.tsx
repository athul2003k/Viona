"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAtomValue } from "jotai";

import { getWorkflowWithNodes, updateWorkflowNodes, WorkflowWithNodesAndEdges } from "../workflow-actions";
import { Editor } from "../components/editor/editor";
import { editorAtom } from "../components/editor/store/atom";

export default function WorkflowPage() {
    const params = useParams();
    const router = useRouter();
    const workflowId = params.workflowId as string;
    const editor = useAtomValue(editorAtom);

    const [workflow, setWorkflow] = useState<WorkflowWithNodesAndEdges | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchWorkflow = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getWorkflowWithNodes(workflowId);
            setWorkflow(data);
        } catch {
            toast.error("Failed to load workflow");
        } finally {
            setIsLoading(false);
        }
    }, [workflowId]);

    useEffect(() => {
        fetchWorkflow();
    }, [fetchWorkflow]);

    const handleSave = useCallback(async () => {
        if (!editor) return;

        setIsSaving(true);
        try {
            const currentNodes = editor.getNodes();
            const currentEdges = editor.getEdges();
            await updateWorkflowNodes(workflowId, currentNodes, currentEdges);
            toast.success("Workflow saved successfully");
        } catch (err) {
            console.error("Failed to save workflow:", err);
            toast.error("Failed to save workflow");
        } finally {
            setIsSaving(false);
        }
    }, [editor, workflowId]);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Custom workflow action bar */}
            <div className="flex items-center justify-between px-8 py-3 bg-background border-b">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-full"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <h1 className="text-xl font-semibold tracking-tight">
                        {workflow?.name || "Workflow"}
                    </h1>
                </div>

                {!isLoading && workflow && (
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !editor}
                        size="sm"
                        className="gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <SaveIcon className="h-4 w-4" />
                        )}
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <LoadingSpinner />
                    </div>
                )}

                {!isLoading && !workflow && (
                    <div className="flex items-center justify-center h-full">
                        <Card className="p-8 text-center max-w-md shadow-sm">
                            <h2 className="text-lg font-semibold">
                                Workflow Not Found
                            </h2>
                            <p className="text-muted-foreground mt-2 text-sm">
                                The workflow you are looking for does not exist.
                            </p>

                            <Button
                                variant="outline"
                                className="mt-6"
                                onClick={() => router.push("/workflows")}
                            >
                                Back to Workflows
                            </Button>
                        </Card>
                    </div>
                )}

                {!isLoading && workflow && (
                    <Editor workflowId={workflowId} />
                )}
            </div>
        </div>
    );
}
