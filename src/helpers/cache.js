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

export const getCachedResult = async (
  key,
  fetchDataFn,
  expirationSeconds = 780
) => {

  try {
    // Check LRU cache first
    const lruValue = lruCache.get(key);
    if (lruValue !== -1) return lruValue;

    if (!redisClient) {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        pingInterval: 1000,
      });
      await redisClient.connect();
    }

    let value = await redisClient.get(key);
    if (value !== null) {
      const parsedValue = JSON.parse(value);
      lruCache.put(key, parsedValue);
      return parsedValue;
    }

    value = await fetchDataFn();
    await redisClient.set(key, JSON.stringify(value), {
      EX: expirationSeconds,
    });
    lruCache.put(key, value);

    return value;
  } catch (error) {
    console.error("Redis cache error:", error);
    return await fetchDataFn();
  }
};
export const invalidateCache = async (key) => {
  try {
    if (!redisClient) {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        pingInterval: 1000,
      });
      await redisClient.connect();
    }

    await redisClient.del(key);
  } catch (error) {
    console.error("Redis invalidate cache error:", error);
  }
};
