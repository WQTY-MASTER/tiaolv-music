# Cloud Client Request Boundary Implementation Plan

> Execute inline using executing-plans. Preserve the existing dirty workspace;
> do not create commits, reset files, change branches or restart services.

**Goal:** Make device/online route ownership explicit while preserving all
existing standalone backend URLs, authorization and playback behavior.

**Architecture:** A pure shared TypeScript module classifies application paths
and resolves standalone URLs. Renderer/preload/main consume the same contract;
both logical owners still use the current loopback backend. No remote switch.

**Tech Stack:** TypeScript, Electron/Vue, node:test, existing verification runner.

## 1. Shared Boundary (Red/Green)

Files: create `electron/src/shared/backendRoutes.ts` and
`electron/tests/backend-routes.test.cjs`.

- [x] Write focused tests for ownership, false prefixes, query/fragment handling,
  external hosts, current origin identity, standalone/preview URLs and resources.
- [x] Run `node --test electron/tests/backend-routes.test.cjs`; expect assertions
  explaining the missing shared boundary, not unrelated loader failures.
- [x] Implement this exported contract:

```ts
export const LOCAL_BACKEND_ORIGIN = "http://127.0.0.1:17890";
export type BackendRouteOwner = "device" | "online";
export function backendRouteOwner(path: string): BackendRouteOwner | null;
export function isLocalBackendUrl(value: string | URL): boolean;
export function standaloneBackendRequestUrl(path: string, previewOrigin?: string): string;
export function resolveStandaloneBackendResourceUrl(path: string, previewOrigin?: string): string;
```

Device roots: library/playback/cache and exact health. Online roots:
auth/account/catalog. Use `URL` for pathname parsing and exact-origin identity.
The standalone origin map has device and online entries, both equal to the
existing origin. Unknown relative resource paths retain legacy concatenation;
external HTTP/file/data/blob URLs stay unchanged.

- [x] Re-run focused tests and verify green without broadening origin trust.

## 2. Renderer and Preload

Files: `electron/src/renderer/src/services/api.ts`,
`electron/src/preload/preload.ts`, `electron/tests/page-api-cache.test.cjs`,
`electron/tests/backend-boundary-integration.test.cjs`, `electron/tests/playlist-detail-contract.test.cjs`.

- [x] Add regression tests for device/online request URLs, current-account
  204/404, encoded audio queries and unchanged external resources.
- [x] Add behavior tests executing the actual preload in a TypeScript/VM harness,
  mocking only Electron transport and fetch; cover library, playback and search.
- [x] Replace the renderer's hardcoded origin with the shared constant and delegate
  URL decisions without changing the public API:

```ts
function backendRequestUrl(path: string) {
  return standaloneBackendRequestUrl(path, previewBackendOrigin());
}
```

`previewBackendOrigin()` returns the current HTTP page origin only when
`window.listenMusic` is absent, preserving existing preview behavior. Resource
resolution delegates to `resolveStandaloneBackendResourceUrl` with that origin.
Preload uses `standaloneBackendRequestUrl(path)` for its existing fetch calls.

- [x] Extend test-only Node module hooks for the new extensionless TypeScript
  import. Retain existing cache, timeout/cancellation and status handling tests.
- [x] Replace obsolete source-text URL assertions with shared-boundary integration
  assertions while retaining independent behavior coverage in the new suite.

## 3. Main and Authorization

Files: `electron/src/main/main.ts`, `electron/src/main/backendAccess.ts`,
`electron/tests/backend-access.test.cjs`, `electron/tests/streaming-cloud-contract.test.cjs`,
`electron/tests/backend-boundary-integration.test.cjs`.

- [x] Test actual upload/cover/download IPC handlers with synthetic Electron and
  file/fetch dependencies. Verify internal tokens and external token absence,
  redirect policy, upload target and retained Range headers.
- [x] Delegate main upload target resolution to the shared standalone helper:

```ts
standaloneBackendRequestUrl("/account/netease/cloud/tracks")
```

Use `isLocalBackendUrl` for exact-origin request decisions, retaining the
existing trusted-window/frame checks, redirect policies and header stripping.
`backendAccess.ts` preserves `BACKEND_ORIGIN` as an alias of the shared constant.

- [x] Update contract assertions to the new helper calls; do not change the
  service manager, manifest, token storage, navigation or proxy protection.
- [x] Run focused boundary/API/access/proxy/contract tests and verify green.

## 4. Acceptance and Documentation

Files: `electron/package.json`, `docs/release-checklist.md`, this plan and spec.

- [x] Add `test:backend-routes` using the existing standalone test-script pattern:

```json
"test:backend-routes": "node --test tests/backend-routes.test.cjs && node --test tests/backend-boundary-integration.test.cjs"
```

- [x] Run `node scripts/verify.cjs frontend` and `node scripts/verify.cjs typecheck`.
- [x] Run `npm --prefix electron run build` and `node scripts/verify.cjs e2e` with
  the existing loopback preview and Playwright module path. No service shutdown.
- [x] Review the diff for secret exposure, API behavior changes and scope drift;
  run `git diff --check` and document actual test results and limitations.
- [x] Mark verified steps complete. Do not rebuild/distribute a cloud installer;
  the server/login/user-isolation phases remain unimplemented.

Review completed without actionable findings. An independent focused rerun
passed 22 tests. Full acceptance results and unverified real-network behavior
are recorded in `docs/release-checklist.md`.
