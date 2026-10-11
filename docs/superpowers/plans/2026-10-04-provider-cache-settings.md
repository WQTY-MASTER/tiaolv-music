# Provider Cache Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a functional Cache settings page backed by provider-aware disk caching, statistics, configurable storage, and safe clearing.

**Architecture:** A backend cache service owns settings and resources. Online catalog reads become read-through cached, while Electron exposes the existing directory picker and the Vue settings page calls the backend management API.

**Tech Stack:** Java 21, Spring Boot, Jackson, JUnit 5, Electron, Vue 3, TypeScript, Node contract tests.

---

### Task 1: Cache Domain And Storage

**Files:**
- Create: `backend/src/main/java/com/listenmusic/service/ProviderResourceCache.java`
- Create: `backend/src/test/java/com/listenmusic/service/ProviderResourceCacheTest.java`

- [ ] Write tests for default settings, provider-isolated keys, disabled writes, persisted settings, statistics, clearing, and directory migration.
- [ ] Run `mvn -Dtest=ProviderResourceCacheTest test` and confirm the tests fail because the service is missing.
- [ ] Implement normalized paths, SHA-256 keys, atomic JSON writes, guarded category deletion, and persisted settings.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Provider Read-Through Integration

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/service/OnlineCatalogService.java`
- Modify: `backend/src/main/java/com/listenmusic/service/LocalLyricsCache.java`
- Create: `backend/src/test/java/com/listenmusic/service/OnlineCatalogCacheTest.java`

- [ ] Write tests proving metadata, lyrics, and covers are reused without a second provider call and that local lyric cache uses the managed category.
- [ ] Run the focused tests and confirm they fail on the uncached service.
- [ ] Add cache reads before provider calls and cache writes only after successful results.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Cache Management API

**Files:**
- Create: `backend/src/main/java/com/listenmusic/api/CacheController.java`
- Create: `backend/src/test/java/com/listenmusic/api/CacheControllerTest.java`

- [ ] Write MVC tests for get settings/statistics, update settings, restore default, and clear.
- [ ] Run the controller test and confirm missing routes fail.
- [ ] Implement `/cache` management routes and validation responses.
- [ ] Re-run the controller test and confirm it passes.

### Task 4: Renderer API And Settings Page

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/settings-page-contract.test.cjs`
- Create: `electron/tests/cache-settings-contract.test.cjs`

- [ ] Add failing contracts for the Cache navigation item, directory controls, three switches, statistics, confirmation copy, and REST functions.
- [ ] Run the focused Node tests and confirm the new contract fails.
- [ ] Add typed cache API helpers, page state, loading/error handling, directory selection, restore, persistence, refresh, and clear actions.
- [ ] Add a responsive Cache settings layout consistent with existing settings cards.
- [ ] Re-run focused tests and confirm they pass.

### Task 5: Regression And Visual Verification

**Files:**
- Modify: `electron/package.json`

- [ ] Add the new contract test to `npm test`.
- [ ] Run `mvn test`, `npm test`, and `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Open the Cache settings page in Playwright at desktop and mobile widths, test switches and clear confirmation, and inspect screenshots for clipping or overlap.
- [ ] Keep all changes uncommitted as requested.
