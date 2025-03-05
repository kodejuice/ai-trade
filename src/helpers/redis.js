import { createClient } from 'redis';

let redisClient;

const lock = async (key, ttl = 7) => {
  const result = await redisClient.set(`lock:${key}`, '1', {
    NX: true,
    EX: ttl,
  });
  return result === 'OK';
};

const releaseLock = (key) => redisClient.del(`lock:${key}`);

export const getCachedResult = async (
  key,
  fetchDataFn,
  expirationSeconds = 780
) => {
  try {
    if (!redisClient) {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        pingInterval: 1000,
      });
      await redisClient.connect();
    }

    let value = await redisClient.get(key);
    if (value !== null) return JSON.parse(value);

    if (!(await lock(key))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return getCachedResult(key, fetchDataFn, expirationSeconds);
    }

    try {
      value = await fetchDataFn();
      await redisClient.set(key, JSON.stringify(value), {
        EX: expirationSeconds,
      });
    } catch (error) {
      throw error;
    } finally {
      await releaseLock(key);
    }

    return value;
  } catch (error) {
    console.error('Redis cache error:', error);
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
    console.error('Redis invalidate cache error:', error);
  }
};
