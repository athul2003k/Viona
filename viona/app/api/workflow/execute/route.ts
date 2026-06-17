// API route to enqueue a workflow execution
import { NextRequest, NextResponse } from "next/server";
import { enqueueWorkflow } from "@/lib/queue";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workflowId, initialData } = body;

        if (!workflowId) {
            return NextResponse.json(
                { success: false, error: "workflowId is required" },
                { status: 400 },
            );
        }

        await enqueueWorkflow({ workflowId, initialData });

        return NextResponse.json({ success: true, workflowId });
    } catch (error) {
        console.error("Failed to enqueue workflow:", error);
        return NextResponse.json(
            { success: false, error: "Failed to enqueue workflow" },
            { status: 500 },
        );
    }
}
