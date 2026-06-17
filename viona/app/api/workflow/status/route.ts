// SSE endpoint for streaming workflow node status updates
import { NextRequest } from "next/server";
import { subscribeToStatus } from "@/lib/status-broadcaster";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const workflowId = request.nextUrl.searchParams.get("workflowId");

    if (!workflowId) {
        return new Response("workflowId query param is required", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;
            // Send initial ping
            try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
            } catch (error) {
                isClosed = true;
            }

            // Subscribe to Redis Pub/Sub for this workflow
            const unsubscribe = await subscribeToStatus(workflowId, (data) => {
                if (isClosed) return;
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                } catch {
                    // Stream closed
                    isClosed = true;
                }
            });

            // Clean up when the client disconnects
            request.signal.addEventListener("abort", async () => {
                if (isClosed) return;
                isClosed = true;
                await unsubscribe();
                try {
                    controller.close();
                } catch {
                    // Ignore if already closed
                }
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
