// Next.js instrumentation hook — starts the BullMQ worker and cron scheduler on server boot
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
    // Only run on the server (Node.js runtime), not on edge
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startWorker } = await import("@/lib/worker");
        const { startCronScheduler } = await import("@/lib/cron-scheduler");

        startWorker();
        startCronScheduler();

        console.log("🚀 BullMQ worker + cron scheduler started");
    }
}
