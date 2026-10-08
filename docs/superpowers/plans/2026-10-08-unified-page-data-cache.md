# Unified Page Data Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache successful page API data for the current application run so returning to a page displays content immediately and avoids duplicate network requests.

**Architecture:** Add a generic in-memory stale-while-revalidate LRU cache in the renderer services layer and route JSON GET requests through it. Cache keys combine account scope and request path; App.vue synchronizes provider/account scopes and explicitly invalidates the smallest useful namespace for refreshes and mutations.

**Tech Stack:** TypeScript, Vue 3 Composition API, Electron renderer, Node test runner, electron-vite.

---

### Task 1: Generic in-memory page cache

**Files:**
- Create: `electron/src/renderer/src/services/pageDataCache.ts`
- Create: `electron/tests/page-data-cache.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing cache behavior tests**

Cover fresh hits, stale immediate return with one background refresh, concurrent miss deduplication, failed refresh preserving old data, forced refresh, prefix invalidation, scope clearing and LRU eviction. Use an injected clock and clone plain snapshots so callers cannot mutate stored entries.

```js
test("stale data returns immediately while one refresh updates the snapshot", async () => {
  let now = 0;
  const cache = createPageDataCache({ ttlMs: 10, maxEntries: 3, now: () => now });
  cache.set("qq:user|playlist:1", { tracks: ["old"] });
  now = 20;
  const refresh = deferred();
  const first = await cache.load("qq:user|playlist:1", () => refresh.promise);
  const second = await cache.load("qq:user|playlist:1", () => refresh.promise);
  assert.deepEqual(first, { tracks: ["old"] });
  assert.deepEqual(second, { tracks: ["old"] });
  refresh.resolve({ tracks: ["new"] });
  await refresh.promise;
  assert.deepEqual(cache.get("qq:user|playlist:1")?.snapshot, { tracks: ["new"] });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `node --test tests/page-data-cache.test.cjs` from `electron`.

Expected: FAIL because `pageDataCache.ts` does not exist.

- [ ] **Step 3: Implement the cache service**

Expose the following focused interface:

```ts
export interface PageDataCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export function createPageDataCache(options: PageDataCacheOptions = {}) {
  return {
    get<T>(key: string): { snapshot: T; fresh: boolean } | null,
    set<T>(key: string, snapshot: T): void,
    load<T>(key: string, loader: () => Promise<T>, options?: { force?: boolean }): Promise<T>,
    invalidate(match: string | ((key: string) => boolean)): void,
    clearScope(scope: string): void,
    clear(): void,
    size(): number
  };
}
```

Use `structuredClone` when available, fall back to JSON cloning for plain API snapshots, track `lastAccess`, and store in-flight requests separately. Stale `load` calls return the stored snapshot immediately and start one caught background refresh.

- [ ] **Step 4: Run the cache tests and add them to the full test script**

Run: `node --test tests/page-data-cache.test.cjs`.

Expected: all cache tests pass.

Add `node --test tests/page-data-cache.test.cjs` beside the existing streaming home cache test in `electron/package.json`.

### Task 2: Route renderer GET requests through the cache

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Create: `electron/tests/page-api-cache.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing API cache contract tests**

Assert that `api.ts` imports `createPageDataCache`, builds cache keys from request path plus account scope, exports account-scope and invalidation functions, excludes health/auth/playback/cache-setting endpoints, and clears cached page reads after successful POST/DELETE mutations.

```js
assert.match(api, /createPageDataCache/);
assert.match(api, /setPageDataCacheAccountScope/);
assert.match(api, /invalidatePageDataCache/);
assert.match(api, /method === "GET"[\s\S]*pageDataCache\.load/);
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node tests/page-api-cache.test.cjs`.

Expected: FAIL because the API transport does not use the unified cache.

- [ ] **Step 3: Integrate caching into `request`**

Keep the existing HTTP and error parsing in an uncached `performRequest<T>` helper. The public `request<T>` chooses caching only for safe JSON GET page data.

```ts
const pageDataCache = createPageDataCache({ ttlMs: 300_000, maxEntries: 100 });
const accountScopes = new Map<string, string>();

export function setPageDataCacheAccountScope(provider: string, userId: string) {
  accountScopes.set(provider, userId);
}

export function clearPageDataCacheAccountScope(provider: string, userId?: string) {
  const scope = `${provider}:${userId || accountScopes.get(provider) || "anonymous"}`;
  pageDataCache.clearScope(scope);
  accountScopes.delete(provider);
}

export function invalidatePageDataCache(match?: string | ((key: string) => boolean)) {
  if (match === undefined) pageDataCache.clear();
  else pageDataCache.invalidate(match);
}
```

For `/account/{provider}/...`, prefix the key with that provider's current user ID. Public catalog/search requests use `public`. Do not cache `/health`, authentication/account-discovery, cache settings, playback state, audio streaming, or non-GET requests. After a successful mutation, invalidate cached page GETs for its account provider; use full invalidation when a safe provider cannot be derived.

- [ ] **Step 4: Run API cache and existing cache tests**

Run: `node tests/page-api-cache.test.cjs && node --test tests/page-data-cache.test.cjs tests/streaming-home-cache.test.cjs`.

Expected: all tests pass.

### Task 3: Synchronize account scopes and explicit refreshes

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Create: `electron/tests/page-data-cache-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing App integration assertions**

Verify App.vue registers every loaded provider account with the API cache, clears the logged-out account scope, and invalidates appropriate paths before explicit playlist, home, cloud, social and account-library refreshes. Verify mutations either update current reactive lists or invalidate their account scope.

```js
assert.match(app, /setPageDataCacheAccountScope\(account\.provider, account\.userId\)/);
assert.match(app, /clearPageDataCacheAccountScope/);
assert.match(app, /invalidatePageDataCache/);
```

- [ ] **Step 2: Run the integration contract and verify it fails**

Run: `node tests/page-data-cache-contract.test.cjs`.

Expected: FAIL because App.vue does not synchronize the unified cache.

- [ ] **Step 3: Wire account lifecycle and refresh behavior**

Import the cache controls from `services/api.ts`. After `loadCurrentAccounts`, register each provider/user pair. On logout, clear only the removed account scope. Before explicit refresh actions, invalidate the matching account/home/playlist/cloud prefix; keep existing reactive data in place while the forced request runs. On successful favorite, playlist, follow and cloud mutations, keep existing immediate UI updates and invalidate affected cached GET paths so later navigation cannot restore stale data.

- [ ] **Step 4: Verify navigation behavior**

Extend the contract test to ensure `applyNavigation` uses cached API calls without adding persistent storage and that refresh handlers do not clear visible data before awaiting the new request.

Run: `node tests/page-data-cache-contract.test.cjs`.

Expected: all assertions pass.

### Task 4: Regression verification and documentation

**Files:**
- Modify: `docs/handoff-2026-10-07-qq-api.md`

- [ ] **Step 1: Run focused cache tests**

Run from `electron`:

```powershell
node --test tests/page-data-cache.test.cjs tests/streaming-home-cache.test.cjs
node tests/page-api-cache.test.cjs
node tests/page-data-cache-contract.test.cjs
```

Expected: all pass.

- [ ] **Step 2: Run the complete frontend test suite**

Run: `npm test` from `electron`.

Expected: exit 0.

- [ ] **Step 3: Build the frontend in an isolated output directory**

Run `electron-vite build` with `outDir` directed to the current writable validation directory so the running Electron output is not overwritten.

Expected: main, preload and renderer builds complete successfully.

- [ ] **Step 4: Browser smoke test navigation reuse**

Use the existing Chrome smoke-test pattern with a mocked fetch counter. Open a page, navigate away, return within TTL, and verify content remains visible and the GET counter does not increase. Advance the injected clock past TTL, return again, and verify old content is visible while exactly one background request occurs.

- [ ] **Step 5: Update the handoff record**

Record cache lifetime, 5-minute stale threshold, 100-entry LRU limit, account isolation, explicit refresh behavior, mutation invalidation and exact verification results in `docs/handoff-2026-10-07-qq-api.md`.
