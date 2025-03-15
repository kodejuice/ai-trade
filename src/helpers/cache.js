import fs from "fs/promises";
import path from "path";
import { createClient } from "redis";

import { LRUCache } from "./lru-cache.js";

// IO
export async function getCachedDataIO(key, fetchData) {
  const cacheDir = path.join(process.cwd(), "tmp");
  const cacheFile = path.join(cacheDir, "cache.json");

  try {
    // Create cache directory if it doesn't exist
    await fs.mkdir(cacheDir, { recursive: true });

    // Try to read existing cache
    let cache = {};
    try {
      const cached = await fs.readFile(cacheFile, "utf8");
      cache = JSON.parse(cached);
    } catch (err) {
      // If file doesn't exist or is invalid, start with empty cache
    }

    // Check if data exists in cache
    if (cache[key]) {
      return cache[key];
    }

    // If cache miss, fetch and process the data
    const data = await fetchData();

    // Update cache with new data
    cache[key] = data;
    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));

    return data;
  } catch (err) {
    console.error("Cache error:", err);
    return await fetchData();
  }
}

// Redis
let redisClient;

const lruCache = new LRUCache(200);

// Redis client configuration
const REDIS_CONFIG = () => ({
  url: process.env.REDIS_URL,
  pingInterval: 1000,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.warn("Redis connection failed after multiple retries, disabling Redis");
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Redis client singleton
let redisEnabled = true;
async function getRedisClient() {
  if (!redisEnabled) {
    // Reset redisEnabled after 30 minutes
    setTimeout(() => {
      redisEnabled = true;
    }, 30 * 60 * 1000);
    return null;
  }
  
  if (!redisClient) {
    try {
      redisClient = createClient(REDIS_CONFIG());
      redisClient.on("error", (err) => {
        console.warn("Redis connection error:", err);
        if (["EADDRNOTAVAIL", "ECONNREFUSED"].includes(err.code)) {
          redisEnabled = false;
        }
      });
      await redisClient.connect();
    } catch (error) {
      console.warn("Failed to connect to Redis:", error);
      redisEnabled = false;
      return null;
    }
  }
  return redisClient;
}

// Cache operations
export async function getCachedResult(key, fetchDataFn, expirationSeconds = 780) {
  try {
    // Check LRU cache first
    const lruValue = lruCache.get(key);
    if (lruValue !== -1) return lruValue;

    const client = await getRedisClient();
    if (client) {
      try {
        const value = await client.get(key);
        if (value !== null) {
          const parsedValue = JSON.parse(value);
          lruCache.put(key, parsedValue);
          return parsedValue;
        }
      } catch (error) {
        console.warn("Redis get operation failed:", error);
        redisEnabled = false;
      }
    }

    // Fallback to fetching fresh data
    const value = await fetchDataFn();
    lruCache.put(key, value);
    
    if (client) {
      await client.set(key, JSON.stringify(value), { EX: expirationSeconds })
        .catch(error => console.warn("Redis set operation failed:", error));
    }
    
    return value;
  } catch (error) {
    console.error("Cache error:", error);
    return await fetchDataFn();
  }
}

export async function setCachedResult(key, value, expirationSeconds = 780) {
  lruCache.put(key, value);
  const client = await getRedisClient();
  if (client) {
    await client.set(key, JSON.stringify(value), { EX: expirationSeconds })
      .catch(error => console.warn("Redis set operation failed:", error));
  }
}

export async function invalidateCache(key) {
  lruCache.remove(key);
  const client = await getRedisClient();
  if (client) {
    await client.del(key)
      .catch(error => console.warn("Redis delete operation failed:", error));
  }
}
