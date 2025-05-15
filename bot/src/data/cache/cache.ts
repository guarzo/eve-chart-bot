type CacheEntry = { ts: number; data: any };
const store = new Map<string, CacheEntry>();
const TTL = Number(process.env.CACHE_TTL_SECONDS) * 1000;

export function getCached<T>(key: string): T | null {
  const e = store.get(key);
  if (!e || Date.now() - e.ts > TTL) {
    store.delete(key);
    return null;
  }
  return e.data;
}

export function setCached(key: string, data: any) {
  store.set(key, { ts: Date.now(), data });
}
