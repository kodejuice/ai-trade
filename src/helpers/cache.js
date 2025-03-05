import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// TODO: Use Redis?

export async function getCachedData(key, fetchData) {
  // Create hash of key for cache filename
  const hash = crypto.createHash('md5').update(key).digest('hex');
  const cacheDir = path.join(process.cwd(), 'tmp');
  const cacheFile = path.join(cacheDir, `${hash}.json`);

  try {
    // Try to read from cache first
    await fs.mkdir(cacheDir, { recursive: true });
    const cached = await fs.readFile(cacheFile, 'utf8');
    return JSON.parse(cached);
  } catch (err) {
    // If cache miss or error, fetch and process the data
    const data = await fetchData();

    // Cache the result
    await fs.writeFile(cacheFile, JSON.stringify(data));
    return data;
  }
}
