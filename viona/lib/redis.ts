// File: lib/redis.ts
import { createClient } from "redis";

// Validate ENV
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL must be set (e.g., redis://redis:6379)");
}

// Create Redis client
export const redis = createClient({
  url: process.env.REDIS_URL,
});

// Log errors
redis.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

// Ensure connection is established ONCE
let initialized = false;

export const initRedis = async () => {
  if (!initialized) {
    await redis.connect();
    initialized = true;
    console.log("✅ Connected to Local Redis:", process.env.REDIS_URL);
  }
};

// Initialize immediately for server actions
initRedis();

// -------------------------
// Cache Configuration
// -------------------------
export const CACHE_CONFIG = {
  TTL: {
    PRODUCTS: 60 * 15,
    ORGANIZATIONS: 60 * 30,
    USER_DATA: 60 * 10,
    DASHBOARD_STATS: 60 * 10,    
    DASHBOARD_ORDERS: 60 * 10,     
    DASHBOARD_WORKFLOWS: 60 * 10, 
    DASHBOARD_LOW_STOCK: 60 * 10, 
    DASHBOARD_CHART: 60 * 10,      
  },

  KEYS: {
    PRODUCTS: "products",
    ORGANIZATIONS: "organizations",
    USER_ORGS: "user-organizations",
    ORG_MEMBERS: "org-members",
    LAST_MODIFIED: "last-modified",
    DASHBOARD_STATS: "dashboard:stats",
    DASHBOARD_ORDERS: "dashboard:orders",
    DASHBOARD_WORKFLOWS: "dashboard:workflows",
    DASHBOARD_LOW_STOCK: "dashboard:low-stock",
    DASHBOARD_CHART: "dashboard:chart",
  },

  VERSION: "v1",
} as const;

// Key Helpers
export const getCacheKey = (prefix: string, ...identifiers: (string | number)[]) => {
  return `${CACHE_CONFIG.VERSION}:${prefix}:${identifiers.join(":")}`;
};

export const getLastModifiedKey = (resource: string, orgId: string) => {
  return getCacheKey(CACHE_CONFIG.KEYS.LAST_MODIFIED, resource, orgId);
};
