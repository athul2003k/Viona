"use server";

import { prisma } from "@/lib/prisma";
import { CacheService } from "@/lib/cache";

export async function getDashboardStats(orgId: string) {
    try {
        const cached = await CacheService.getDashboardStats(orgId);
        if (cached) return cached;

        const id = BigInt(orgId);

        // Run queries in parallel
        const [
            totalWorkflows,
            totalOrders,
            totalProducts,
            revenueResult
        ] = await Promise.all([
            prisma.workflow.count({ where: { org_id: id } }),
            prisma.order.count({ where: { org_id: id } }),
            prisma.product.count({ where: { org_id: id } }),
            prisma.order.aggregate({
                where: { org_id: id },
                _sum: { total_amount: true }
            })
        ]);

        const result = {
            workflows: totalWorkflows,
            orders: totalOrders,
            products: totalProducts,
            revenue: revenueResult._sum.total_amount ? Number(revenueResult._sum.total_amount) : 0
        };

        await CacheService.setDashboardStats(orgId, result);
        return result;
    } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
        return { workflows: 0, orders: 0, products: 0, revenue: 0 };
    }
}

export async function getRecentWorkflows(orgId: string, limit = 5) {
    try {
        const cached = await CacheService.getRecentWorkflows(orgId);
        if (cached) return cached;

        const workflows = await prisma.workflow.findMany({
            where: { org_id: BigInt(orgId) },
            orderBy: { updated_at: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                status: true,
                updated_at: true,
            }
        });

        // Convert dates to string for serialization
        const result = workflows.map(w => ({
            ...w,
            updated_at: w.updated_at.toISOString()
        }));

        await CacheService.setRecentWorkflows(orgId, result);
        return result;
    } catch (error) {
        console.error("Failed to fetch recent workflows", error);
        return [];
    }
}

export async function getRecentOrders(orgId: string, limit = 5) {
    try {
        const cached = await CacheService.getRecentOrders(orgId);
        if (cached) return cached;

        const orders = await prisma.order.findMany({
            where: { org_id: BigInt(orgId) },
            orderBy: { created_at: 'desc' },
            take: limit,
            select: {
                order_id: true,
                customer_name: true,
                status: true,
                total_amount: true,
                created_at: true,
            }
        });

        const result = orders.map(o => ({
            id: o.order_id.toString(),
            customer: o.customer_name || 'Unknown',
            status: o.status || 'pending',
            amount: o.total_amount ? Number(o.total_amount) : 0,
            date: o.created_at ? o.created_at.toISOString() : new Date().toISOString()
        }));

        await CacheService.setRecentOrders(orgId, result);
        return result;
    } catch (error) {
        console.error("Failed to fetch recent orders", error);
        return [];
    }
}

export async function getLowStockProducts(orgId: string, limit = 5, threshold = 10) {
    try {
        const cached = await CacheService.getLowStock(orgId);
        if (cached) return cached;

        // Find products whose total stock across all warehouses is below threshold
        const stockItems = await prisma.productStock.groupBy({
            by: ['product_id'],
            where: { product: { org_id: BigInt(orgId) } },
            _sum: { quantity: true },
            having: {
                quantity: {
                    _sum: { lt: threshold }
                }
            },
            orderBy: {
                _sum: { quantity: 'asc' }
            },
            take: limit
        });

        if (stockItems.length === 0) return [];

        const productIds = stockItems.map(s => s.product_id);
        const products = await prisma.product.findMany({
            where: { product_id: { in: productIds } },
            select: {
                product_id: true,
                name: true,
                sku: true
            }
        });

        const result = products.map(p => {
            const stock = stockItems.find(s => s.product_id === p.product_id);
            return {
                id: p.product_id.toString(),
                name: p.name || 'Unnamed Product',
                sku: p.sku || 'N/A',
                quantity: stock?._sum?.quantity ?? 0
            };
        });

        await CacheService.setLowStock(orgId, result);
        return result;
    } catch (error) {
        console.error("Failed to fetch low stock products", error);
        return [];
    }
}

export async function getRevenueChartData(orgId: string) {
    try {
        const cached = await CacheService.getChartData(orgId);
        if (cached) return cached;

        const id = BigInt(orgId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const orders = await prisma.order.findMany({
            where: {
                org_id: id,
                created_at: {
                    gte: thirtyDaysAgo
                }
            },
            select: {
                total_amount: true,
                created_at: true
            }
        });

        // Group by date string (YYYY-MM-DD)
        const dailyRevenue: Record<string, number> = {};

        // Initialize last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyRevenue[dateStr] = 0;
        }

        orders.forEach(order => {
            if (order.created_at && order.total_amount) {
                const dateStr = order.created_at.toISOString().split('T')[0];
                if (dailyRevenue[dateStr] !== undefined) {
                    dailyRevenue[dateStr] += Number(order.total_amount);
                }
            }
        });

        const result = Object.entries(dailyRevenue).map(([date, revenue]) => ({
            date,
            revenue
        }));

        await CacheService.setChartData(orgId, result);
        return result;

    } catch (error) {
        console.error("Failed to fetch revenue chart data", error);
        return [];
    }
}
