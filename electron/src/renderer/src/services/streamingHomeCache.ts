export const STREAMING_HOME_CACHE_TTL_MS = 5 * 60 * 1000;

interface StreamingHomeCacheEntry<T> {
  accountId: string;
  snapshot: T;
  cachedAt: number;
}

export interface StreamingHomeCacheHit<T> {
  snapshot: T;
  fresh: boolean;
}

export function createStreamingHomeCache<T>(
  ttlMs = STREAMING_HOME_CACHE_TTL_MS,
  now: () => number = Date.now
) {
  const entries = new Map<string, StreamingHomeCacheEntry<T>>();

  return {
    set(provider: string, accountId: string, snapshot: T): void {
      entries.set(provider, { accountId, snapshot, cachedAt: now() });
    },

    get(provider: string, accountId: string): StreamingHomeCacheHit<T> | null {
      const entry = entries.get(provider);
      if (!entry || entry.accountId !== accountId) return null;
      return {
        snapshot: entry.snapshot,
        fresh: now() - entry.cachedAt <= ttlMs
      };
    },

    clear(provider: string): void {
      entries.delete(provider);
    }
  };
}
