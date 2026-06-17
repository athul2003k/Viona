// Redis Pub/Sub based status broadcaster
// Replaces @inngest/realtime publish() 
import { createClient, type RedisClientType } from "redis";

const CHANNEL_PREFIX = "workflow-status";

let publisher: RedisClientType | null = null;

async function getPublisher(): Promise<RedisClientType | null> {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CI) return null;

    if (!publisher) {
        publisher = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" }) as RedisClientType;
        publisher.on("error", (err) => console.error("Status publisher error:", err));
        await publisher.connect();
    }
    return publisher;
}

/**
 * Broadcast a node status update for a workflow execution.
 * All SSE clients listening for this workflowId will receive the event.
 */
export async function broadcastStatus(
    workflowId: string,
    nodeId: string,
    status: "loading" | "success" | "error",
) {
    const pub = await getPublisher();
    if (!pub) return;

    const channel = `${CHANNEL_PREFIX}:${workflowId}`;
    const payload = JSON.stringify({ nodeId, status, timestamp: Date.now() });
    await pub.publish(channel, payload);
}

/**
 * Subscribe to status updates for a specific workflow.
 * Returns an unsubscribe function.
 */
export async function subscribeToStatus(
    workflowId: string,
    onMessage: (data: { nodeId: string; status: string; timestamp: number }) => void,
): Promise<() => Promise<void>> {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CI) {
        return async () => { };
    }

    const subscriber = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" }) as RedisClientType;
    subscriber.on("error", (err) => console.error("Status subscriber error:", err));
    await subscriber.connect();

    const channel = `${CHANNEL_PREFIX}:${workflowId}`;
    await subscriber.subscribe(channel, (message) => {
        try {
            const data = JSON.parse(message);
            onMessage(data);
        } catch (e) {
            console.error("Failed to parse status message:", e);
        }
    });

    return async () => {
        await subscriber.unsubscribe(channel);
        await subscriber.disconnect();
    };
}
