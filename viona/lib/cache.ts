// File: lib/cache.ts
import { redis, CACHE_CONFIG, getCacheKey, getLastModifiedKey } from './redis';
import { Product } from '@/app/api/inventory/products/route';

export class CacheService {
  // Generic cache methods
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) as T : null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  static async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), { EX: ttl });
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  // Last modified helpers
  static async setLastModified(resource: string, orgId: string): Promise<void> {
    const key = getLastModifiedKey(resource, orgId);
    const timestamp = Date.now().toString();

    try {
      await redis.set(key, timestamp, { EX: CACHE_CONFIG.TTL.PRODUCTS * 2 });
    } catch (error) {
      console.error("Set last modified error:", error);
    }
  }

  static async getLastModified(resource: string, orgId: string): Promise<number | null> {
    const key = getLastModifiedKey(resource, orgId);

    try {
      const ts = await redis.get(key);
      return ts ? Number(ts) : null;
    } catch (error) {
      console.error("Get last modified error:", error);
      return null;
    }
  }

  // Product cache
  static async getProducts(orgId: string): Promise<Product[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.PRODUCTS, orgId);
    return this.get<Product[]>(key);
  }

  static async setProducts(orgId: string, products: Product[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.PRODUCTS, orgId);
    await this.set(key, products, CACHE_CONFIG.TTL.PRODUCTS);
    await this.setLastModified("products", orgId);
  }

  static async invalidateProducts(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.PRODUCTS, orgId);
    await this.del(key);
    await this.setLastModified("products", orgId);
  }

  // User organizations cache
  static async getUserOrganizations(userId: string): Promise<any[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.USER_ORGS, userId);
    return this.get<any[]>(key);
  }

  static async setUserOrganizations(userId: string, organizations: any[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.USER_ORGS, userId);
    await this.set(key, organizations, CACHE_CONFIG.TTL.ORGANIZATIONS);
  }

  static async invalidateUserOrganizations(userId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.USER_ORGS, userId);
    await this.del(key);
  }

  // Cache warmup
  static async warmupCache(orgId: string, products: Product[]): Promise<void> {
    await this.setProducts(orgId, products);
  }

  // Health check
  static async healthCheck(): Promise<boolean> {
    try {
      await redis.set("health-check", "ok", { EX: 5 });
      const value = await redis.get("health-check");
      return value === "ok";
    } catch (error) {
      console.error("Redis health check failed:", error);
      return false;
    }
  }

  // Clear all cache
  static async clearAll(): Promise<void> {
    try {
      const pattern = `${CACHE_CONFIG.VERSION}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys);  // FIXED: correct node-redis format
      }
    } catch (error) {
      console.error("Clear all cache error:", error);
    }
  }

  // -------------------------
  // Dashboard Cache Helpers
  // -------------------------

  static async getDashboardStats(orgId: string): Promise<any | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_STATS, orgId);
    return this.get<any>(key);
  }
  static async setDashboardStats(orgId: string, data: any): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_STATS, orgId);
    await this.set(key, data, CACHE_CONFIG.TTL.DASHBOARD_STATS);
  }
  static async invalidateDashboardStats(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_STATS, orgId);
    await this.del(key);
  }

  static async getRecentOrders(orgId: string): Promise<any[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_ORDERS, orgId);
    return this.get<any[]>(key);
  }
  static async setRecentOrders(orgId: string, orders: any[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_ORDERS, orgId);
    await this.set(key, orders, CACHE_CONFIG.TTL.DASHBOARD_ORDERS);
  }
  static async invalidateDashboardOrders(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_ORDERS, orgId);
    await this.del(key);
  }

  static async getRecentWorkflows(orgId: string): Promise<any[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_WORKFLOWS, orgId);
    return this.get<any[]>(key);
  }
  static async setRecentWorkflows(orgId: string, workflows: any[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_WORKFLOWS, orgId);
    await this.set(key, workflows, CACHE_CONFIG.TTL.DASHBOARD_WORKFLOWS);
  }
  static async invalidateDashboardWorkflows(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_WORKFLOWS, orgId);
    await this.del(key);
  }

  static async getLowStock(orgId: string): Promise<any[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_LOW_STOCK, orgId);
    return this.get<any[]>(key);
  }
  static async setLowStock(orgId: string, products: any[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_LOW_STOCK, orgId);
    await this.set(key, products, CACHE_CONFIG.TTL.DASHBOARD_LOW_STOCK);
  }
  static async invalidateDashboardLowStock(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_LOW_STOCK, orgId);
    await this.del(key);
  }

  static async getChartData(orgId: string): Promise<any[] | null> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_CHART, orgId);
    return this.get<any[]>(key);
  }
  static async setChartData(orgId: string, data: any[]): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_CHART, orgId);
    await this.set(key, data, CACHE_CONFIG.TTL.DASHBOARD_CHART);
  }
  static async invalidateDashboardChart(orgId: string): Promise<void> {
    const key = getCacheKey(CACHE_CONFIG.KEYS.DASHBOARD_CHART, orgId);
    await this.del(key);
  }

  static async invalidateAllDashboard(orgId: string): Promise<void> {
    await Promise.all([
      this.invalidateDashboardStats(orgId),
      this.invalidateDashboardOrders(orgId),
      this.invalidateDashboardWorkflows(orgId),
      this.invalidateDashboardLowStock(orgId),
      this.invalidateDashboardChart(orgId)
    ]);
  }
}
