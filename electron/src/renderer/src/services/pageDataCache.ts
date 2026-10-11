export interface PageDataCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export interface PageDataCacheHit<T> {
  snapshot: T;
  fresh: boolean;
}

interface PageDataCacheEntry {
  snapshot: unknown;
  savedAt: number;
  lastAccess: number;
}

function cloneSnapshot<T>(snapshot: T): T {
  if (typeof structuredClone === "function") return structuredClone(snapshot);
  return JSON.parse(JSON.stringify(snapshot)) as T;
}

export function createPageDataCache(options: PageDataCacheOptions = {}) {
  const ttlMs = Math.max(0, options.ttlMs ?? 300_000);
  const maxEntries = Math.max(1, options.maxEntries ?? 100);
  const now = options.now ?? Date.now;
  const entries = new Map<string, PageDataCacheEntry>();
  const inFlight = new Map<string, Promise<unknown>>();

  function evictOverflow() {
    while (entries.size > maxEntries) {
      let oldestKey = "";
      let oldestAccess = Number.POSITIVE_INFINITY;
      for (const [key, entry] of entries) {
        if (entry.lastAccess < oldestAccess) {
          oldestKey = key;
          oldestAccess = entry.lastAccess;
        }
      }
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
  }

  function set<T>(key: string, snapshot: T) {
    inFlight.delete(key);
    const timestamp = now();
    entries.set(key, { snapshot: cloneSnapshot(snapshot), savedAt: timestamp, lastAccess: timestamp });
    evictOverflow();
  }

  function get<T>(key: string): PageDataCacheHit<T> | null {
    const entry = entries.get(key);
    if (!entry) return null;
    const timestamp = now();
    entry.lastAccess = timestamp;
    return {
      snapshot: cloneSnapshot(entry.snapshot as T),
      fresh: timestamp - entry.savedAt <= ttlMs
    };
  }

  function startLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const request = loader().then(snapshot => {
      if (inFlight.get(key) === request) set(key, snapshot);
      return cloneSnapshot(snapshot);
    }).finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
    inFlight.set(key, request);
    return request;
  }

  async function load<T>(key: string, loader: () => Promise<T>, loadOptions: { force?: boolean } = {}): Promise<T> {
    if (!loadOptions.force) {
      const cached = get<T>(key);
      if (cached?.fresh) return cached.snapshot;
      if (cached) {
        void startLoad(key, loader).catch(() => undefined);
        return cached.snapshot;
      }
    }
    return startLoad(key, loader);
  }

  function invalidate(match: string | ((key: string) => boolean)) {
    const matches = typeof match === "string" ? (key: string) => key.startsWith(match) : match;
    for (const key of entries.keys()) if (matches(key)) entries.delete(key);
    for (const key of inFlight.keys()) if (matches(key)) inFlight.delete(key);
  }

  function clearScope(scope: string) {
    invalidate(`${scope}|`);
  }

  return {
    get,
    set,
    load,
    invalidate,
    clearScope,
    clear() {
      entries.clear();
      inFlight.clear();
    },
    size() {
      return entries.size;
    }
  };
}
