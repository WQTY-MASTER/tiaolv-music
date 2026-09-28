# Provider-Isolated Playlist Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add QQ curated playlists to the QQ homepage and a QQ-only discovery experience that reuses the NetEase discovery UI without sharing data state.

**Architecture:** Make catalog discovery endpoints provider-aware, implement QQ discovery mapping in `QqMusicProvider`, and keep per-provider discovery state in the renderer. Add a focused QQ homepage component that emits existing playlist navigation events.

**Tech Stack:** Java 21, Spring Boot, Jackson, Vue 3, TypeScript, Electron Vite, Node contract tests

---

### Task 1: Provider-aware catalog discovery

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/api/CatalogController.java`
- Modify: `backend/src/main/java/com/listenmusic/service/OnlineCatalogService.java`
- Test: `backend/src/test/java/com/listenmusic/api/CatalogControllerTest.java`

- [ ] Add failing controller tests proving `provider=qq` reaches the QQ provider for categories and playlists.
- [ ] Add optional provider parameters to category, playlist and high-quality endpoints.
- [ ] Route each service call through `provider(providerId)` while retaining NetEase defaults.
- [ ] Run the targeted controller tests.

### Task 2: QQ recommendation and discovery mapping

**Files:**
- Modify: `music-api/qq-music-api/src/controllers/getRecommend.ts`
- Modify: `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`
- Test: `backend/src/test/java/com/listenmusic/provider/QqMusicProviderTest.java`

- [ ] Add failing provider tests for curated recommendations, category groups and paged discovery items.
- [ ] Allow `/getRecommend` to receive category, page, size and order parameters.
- [ ] Map QQ recommendation and playlist-plaza response fields into existing provider records.
- [ ] Run QQ provider tests and QQ API TypeScript checking.

### Task 3: Separate renderer discovery state by provider

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/StreamingPlaylistDiscoveryPage.vue`
- Test: `electron/tests/streaming-home-contract.test.cjs`

- [ ] Add failing contract assertions for provider-aware requests and isolated state.
- [ ] Add provider parameters to renderer discovery API functions.
- [ ] Store category, sorting, pagination, results and errors separately for NetEase and QQ.
- [ ] Pass the active provider to the shared discovery component and hide QQ high-quality mode.
- [ ] Run the renderer contract test.

### Task 4: QQ homepage curated playlist module

**Files:**
- Create: `electron/src/renderer/src/components/StreamingQqCuratedPlaylists.vue`
- Modify: `electron/src/renderer/src/App.vue`
- Test: `electron/tests/streaming-home-contract.test.cjs`

- [ ] Add failing assertions for QQ-only rendering, "发现更多", and playlist selection.
- [ ] Build the responsive 12-card QQ curated playlist section.
- [ ] Load QQ featured playlists alongside QQ home content and wire existing detail navigation.
- [ ] Run the contract test and Electron production build.
