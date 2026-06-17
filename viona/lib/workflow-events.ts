/**
 * Helper functions that emit Inngest events when inventory or order data changes.
 * Call these explicitly after Prisma writes in your API routes/actions.
 */
import { enqueueWorkflow } from "./queue";
import prisma from "@/lib/prisma";
import { NodeType } from "@prisma/client";

/**
 * Emit workflow events for all workflows in the org that have an INVENTORY_TRIGGER node.
 * Call this after any product/stock/price write.
 */
export async function emitInventoryEvent(
    orgId: bigint | string,
    action: string,
    model: string,
    data: Record<string, any>,
) {
    try {
        const bigOrgId = typeof orgId === "string" ? BigInt(orgId) : orgId;

        const workflows = await prisma.workflow.findMany({
            where: {
                org_id: bigOrgId,
                nodes: { some: { type: NodeType.INVENTORY_TRIGGER } },
            },
            select: { id: true },
        });

        for (const wf of workflows) {
            await enqueueWorkflow({
                workflowId: wf.id,
                initialData: {
                    inventory: {
                        action,
                        model,
                        productId: data?.product_id?.toString() ?? data?.id?.toString(),
                        productName: data?.name ?? undefined,
                        sku: data?.sku ?? undefined,
                        quantity: data?.quantity ?? undefined,
                        data: JSON.parse(JSON.stringify(data, (_key, value) =>
                            typeof value === "bigint" ? value.toString() : value
                        )),
                    },
                },
            });
        }
        console.log(`[Workflow Events] Emitted inventory event to ${workflows.length} workflows`);
    } catch (err) {
        console.error("[Workflow Events] Failed to emit inventory event:", err);
    }
}

/**
 * Emit workflow events for all workflows in the org that have an ORDER_TRIGGER node.
 * Call this after any order/order-item write.
 */
export async function emitOrderEvent(
    orgId: bigint | string,
    action: string,
    model: string,
    data: Record<string, any>,
) {
    try {
        const bigOrgId = typeof orgId === "string" ? BigInt(orgId) : orgId;

        const workflows = await prisma.workflow.findMany({
            where: {
                org_id: bigOrgId,
                nodes: { some: { type: NodeType.ORDER_TRIGGER } },
            },
            select: { id: true },
        });

        for (const wf of workflows) {
            await enqueueWorkflow({
                workflowId: wf.id,
                initialData: {
                    order: {
                        action,
                        model,
                        orderId: data?.order_id?.toString() ?? data?.id?.toString(),
                        status: data?.status ?? undefined,
                        customerName: data?.customer_name ?? undefined,
                        customerEmail: data?.customer_email ?? undefined,
                        total: data?.total_amount?.toString() ?? undefined,
                        data: JSON.parse(JSON.stringify(data, (_key, value) =>
                            typeof value === "bigint" ? value.toString() : value
                        )),
                    },
                },
            });
        }
        console.log(`[Workflow Events] Emitted order event to ${workflows.length} workflows`);
    } catch (err) {
        console.error("[Workflow Events] Failed to emit order event:", err);
    }
}
