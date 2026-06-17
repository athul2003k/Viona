// lib/client-cache.ts
export class ClientCache {
  private cache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();
  private readonly TTL = 2 * 60 * 1000; // 2 minutes

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    
    // Return cached data if still valid
    if (cached && (Date.now() - cached.timestamp) < this.TTL) {
      console.log(`Client cache HIT for ${key}`);
      return cached.data;
    }
    
    // If request is in progress, return the promise
    if (cached?.promise) {
      console.log(`Client cache - request in progress for ${key}`);
      return cached.promise;
    }
    
    console.log(`Client cache MISS for ${key} - fetching`);
    
    // Start new request
    const promise = fetcher();
    
    // Store promise immediately to prevent duplicate requests
    this.cache.set(key, {
      data: null,
      timestamp: Date.now(),
      promise
    });
    
    try {
      const data = await promise;
      
      // Store successful result
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      // Remove failed request from cache
      this.cache.delete(key);
      throw error;
    }
  }

  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const clientCache = new ClientCache();
